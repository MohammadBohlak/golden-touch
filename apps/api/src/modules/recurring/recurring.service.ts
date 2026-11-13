import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { BookingStatus, Prisma } from '@prisma/client'
import { isBookingOverlapError } from '../../common/filters/all-exceptions.filter'
import { addDays, dayRangeUtc, toDateString } from '../../common/utils/time'
import { AppConfig } from '../../config/app-config'
import { PrismaService } from '../../prisma/prisma.service'
import { BLOCKING_STATUSES } from '../bookings/booking.mapper'
import type { ShopHours } from '../bookings/schedule'
import { SettingsService } from '../settings/settings.service'
import {
  ExistingOccurrence,
  OccurrenceIssue,
  Plan,
  PlannedOccurrence,
  planOccurrences,
  PlanService,
  planSeriesChange,
  SeriesChange,
  SeriesTemplate,
} from './recurrence'
import { dateOnly, parseDateOnly, SeriesWithServices, toTemplate } from './recurring.mapper'

type Tx = Prisma.TransactionClient

const MSG_RACE = 'تم حجز أحد الأوقات للتو من مستخدم آخر، أعد المحاولة'

/** تعديل القالب: ما لم يُذكر يبقى كما هو */
export interface TemplatePatch {
  customerId?: string
  startDate?: string
  startTime?: string
  intervalWeeks?: number
  endDate?: string | null
  notes?: string | null
  serviceIds?: string[]
}

export interface GenerateResult {
  created: number
  issues: OccurrenceIssue[]
}

export interface ChangeResult {
  removed: number
  created: number
  issues: OccurrenceIssue[]
  keptEdited: number
}

export interface SyncResult {
  series: number
  created: number
  issues: number
  failed: number
}

export interface Context {
  hours: ShopHours
  services: PlanService[]
  /** لقطات الخدمات اللازمة لإنشاء الحجز (السعر داخلي ولا يُرسَل لأي عميل) */
  rows: Map<string, { name: string; price: number; durationMinutes: number }>
  from: string
  to: string
}

/**
 * توليد الحجوزات الدورية: يحوّل قالب السلسلة إلى حجوزات عادية ضمن أفق متحرّك.
 * المولّد **يسدّ الفراغات فقط** ويتكرر تشغيله بأمان (قيد فريد + skipDuplicates)،
 * فأي موعد فات بسبب خطأ أو سباق يُملأ في المزامنة التالية.
 * docs/RECURRING_BOOKINGS_PLAN.md
 */
@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly config: AppConfig,
  ) {}

  // ───────────────────────── التوليد ─────────────────────────

  /** يسدّ فراغات سلسلة واحدة حتى نهاية الأفق */
  async generate(seriesId: string, now: Date = new Date()): Promise<GenerateResult> {
    const series = await this.loadSeries(seriesId)
    const template = toTemplate(series)
    if (template.stopped) return { created: 0, issues: [] }

    const { ctx, plans } = await this.fillPlans([series], now)
    const plan = plans.get(seriesId)!
    return { created: await this.insert(series, plan.create, ctx), issues: plan.issues }
  }

  /**
   * خطة سدّ الفراغات لعدة سلاسل بأقل استعلامات (القاعدة بعيدة): إعدادات وخدمات ومشغول
   * وحجوزات موجودة مرة واحدة للجميع. بلا أي كتابة. الموقوفة تُتجاهل.
   */
  async fillPlans(
    list: SeriesWithServices[],
    now: Date,
  ): Promise<{ ctx: Context; plans: Map<string, Plan> }> {
    const active = list.filter((s) => s.stoppedAt === null)
    const ctx = await this.loadContext(
      active.flatMap((s) => s.services.map((x) => x.serviceId)),
      now,
    )
    const plans = new Map<string, Plan>()
    if (!active.length) return { ctx, plans }

    const [busy, existing] = await Promise.all([
      this.busy(ctx),
      this.prisma.booking.findMany({
        where: {
          recurringId: { in: active.map((s) => s.id) },
          occurrenceDate: { gte: parseDateOnly(ctx.from), lte: parseDateOnly(ctx.to) },
        },
        select: { recurringId: true, occurrenceDate: true },
      }),
    ])
    const datesOf = new Map<string, Set<string>>()
    for (const b of existing) {
      if (!b.recurringId || !b.occurrenceDate) continue
      const set = datesOf.get(b.recurringId) ?? new Set<string>()
      set.add(dateOnly(b.occurrenceDate))
      datesOf.set(b.recurringId, set)
    }
    for (const series of active) {
      plans.set(
        series.id,
        planOccurrences({
          series: toTemplate(series),
          services: ctx.services,
          hours: ctx.hours,
          from: ctx.from,
          to: ctx.to,
          now,
          existingDates: datesOf.get(series.id) ?? new Set(),
          busy,
        }),
      )
    }
    return { ctx, plans }
  }

  /** المزامنة الدورية: كل السلاسل الفعّالة. فشل سلسلة لا يوقف البقية */
  async syncAll(now: Date = new Date()): Promise<SyncResult> {
    const { timezone } = await this.settings.get()
    const today = toDateString(now, timezone)
    const active = await this.prisma.recurringBooking.findMany({
      where: {
        stoppedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: parseDateOnly(today) } }],
      },
      select: { id: true },
    })
    const result: SyncResult = { series: active.length, created: 0, issues: 0, failed: 0 }
    for (const { id } of active) {
      try {
        const generated = await this.generate(id, now)
        result.created += generated.created
        result.issues += generated.issues.length
      } catch (error) {
        result.failed++
        this.logger.warn(
          `Recurring generate failed: ${error instanceof Error ? error.message : error}`,
        )
      }
    }
    return result
  }

  // ───────────────────────── المعاينة والتعديل والإيقاف ─────────────────────────

  /**
   * معاينة بلا أي كتابة. بلا seriesId = سلسلة جديدة (لا حجوزات قائمة)،
   * ومعه = ما يحدث لو طُبّق القالب على حجوزات تلك السلسلة.
   */
  async preview(
    template: SeriesTemplate,
    seriesId?: string,
    now: Date = new Date(),
  ): Promise<SeriesChange> {
    const ctx = await this.loadContext(template.serviceIds, now)
    return this.computeChange(template, ctx, now, seriesId)
  }

  /** تعديل القالب وإعادة كتابة المواعيد القادمة غير المعدّلة (D9) في معاملة واحدة */
  async replaceFuture(
    seriesId: string,
    patch: TemplatePatch,
    now: Date = new Date(),
  ): Promise<ChangeResult> {
    const series = await this.loadSeries(seriesId)
    const current = toTemplate(series)
    const template: SeriesTemplate = {
      ...current,
      ...(patch.startDate !== undefined && { startDate: patch.startDate }),
      ...(patch.startTime !== undefined && { startTime: patch.startTime }),
      ...(patch.intervalWeeks !== undefined && { intervalWeeks: patch.intervalWeeks }),
      ...(patch.endDate !== undefined && { endDate: patch.endDate }),
      ...(patch.serviceIds !== undefined && { serviceIds: patch.serviceIds }),
    }
    const ctx = await this.loadContext(template.serviceIds, now)
    const change = await this.computeChange(template, ctx, now, seriesId)
    const merged = {
      ...series,
      customerId: patch.customerId ?? series.customerId,
      notes: patch.notes !== undefined ? patch.notes : series.notes,
    }

    const outcome = await this.guardRace(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.recurringBooking.update({
          where: { id: seriesId },
          data: {
            customerId: patch.customerId,
            startDate: patch.startDate ? parseDateOnly(patch.startDate) : undefined,
            startTime: patch.startTime,
            intervalWeeks: patch.intervalWeeks,
            endDate:
              patch.endDate === undefined
                ? undefined
                : patch.endDate
                  ? parseDateOnly(patch.endDate)
                  : null,
            notes: patch.notes,
          },
        })
        if (patch.serviceIds) {
          await tx.recurringBookingService.deleteMany({ where: { recurringId: seriesId } })
          await tx.recurringBookingService.createMany({
            data: patch.serviceIds.map((serviceId, position) => ({
              recurringId: seriesId,
              position,
              serviceId,
            })),
          })
        }
        const removed = await this.deleteRewritable(tx, seriesId, change, now)
        const created = await this.insertIn(tx, merged, change.create, ctx)
        return { removed, created }
      }),
    )
    return { ...outcome, issues: change.issues, keptEdited: change.keptEdited }
  }

  /** إيقاف السلسلة (D10): يحذف القادم غير المعدّل ولا يولّد بعده. تكراره لا أثر له */
  async stop(
    seriesId: string,
    now: Date = new Date(),
  ): Promise<Omit<ChangeResult, 'created' | 'issues'>> {
    const series = await this.loadSeries(seriesId)
    if (series.stoppedAt) return { removed: 0, keptEdited: 0 }

    const template = { ...toTemplate(series), stopped: true }
    const ctx = await this.loadContext(template.serviceIds, now)
    const change = await this.computeChange(template, ctx, now, seriesId)
    const removed = await this.prisma.$transaction(async (tx) => {
      await tx.recurringBooking.update({ where: { id: seriesId }, data: { stoppedAt: now } })
      return this.deleteRewritable(tx, seriesId, change, now)
    })
    return { removed, keptEdited: change.keptEdited }
  }

  // ───────────────────────── مساعدات ─────────────────────────

  async loadSeries(id: string): Promise<SeriesWithServices> {
    const series = await this.prisma.recurringBooking.findUnique({
      where: { id },
      include: { services: { orderBy: { position: 'asc' } } },
    })
    if (!series) throw new NotFoundException('الحجز الدوري غير موجود')
    return series
  }

  /** الإعدادات + الخدمات + نطاق التوليد (من أمس إلى نهاية الأفق؛ أمس لأن دوام ما بعد منتصف الليل) */
  async loadContext(serviceIds: string[], now: Date): Promise<Context> {
    const settings = await this.settings.get()
    const hours: ShopHours = {
      openTime: settings.openTime,
      closeTime: settings.closeTime,
      daysOff: settings.daysOff,
      timezone: settings.timezone,
    }
    const today = toDateString(now, hours.timezone)
    const found = await this.prisma.service.findMany({
      where: { id: { in: [...new Set(serviceIds)] } },
    })
    return {
      hours,
      services: found.map((s) => ({
        id: s.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        available: s.archivedAt === null && s.isActive,
      })),
      rows: new Map(
        found.map((s) => [
          s.id,
          { name: s.name, price: s.price, durationMinutes: s.durationMinutes },
        ]),
      ),
      from: addDays(today, -1),
      to: addDays(today, this.config.recurringHorizonDays),
    }
  }

  /** كل ما يحجز وقتاً داخل النطاق (بما فيه حجوزات السلسلة نفسها) */
  async busy(ctx: Context): Promise<{ id: string; start: Date; end: Date }[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { lt: dayRangeUtc(addDays(ctx.to, 1), ctx.hours.timezone).end },
        endAt: { gt: dayRangeUtc(ctx.from, ctx.hours.timezone).start },
      },
      select: { id: true, startAt: true, endAt: true },
    })
    return rows.map((b) => ({ id: b.id, start: b.startAt, end: b.endAt }))
  }

  private async computeChange(
    template: SeriesTemplate,
    ctx: Context,
    now: Date,
    seriesId?: string,
  ): Promise<SeriesChange> {
    const existing: ExistingOccurrence[] = seriesId
      ? (
          await this.prisma.booking.findMany({
            where: { recurringId: seriesId, occurrenceDate: { gte: parseDateOnly(ctx.from) } },
            select: {
              id: true,
              occurrenceDate: true,
              startAt: true,
              endAt: true,
              status: true,
              recurringEdited: true,
            },
          })
        ).flatMap((b) =>
          b.occurrenceDate
            ? [
                {
                  id: b.id,
                  occurrenceDate: dateOnly(b.occurrenceDate),
                  startAt: b.startAt,
                  endAt: b.endAt,
                  status: b.status,
                  edited: b.recurringEdited,
                },
              ]
            : [],
        )
      : []
    return planSeriesChange({
      series: template,
      services: ctx.services,
      hours: ctx.hours,
      from: ctx.from,
      to: ctx.to,
      now,
      existing,
      busy: await this.busy(ctx),
    })
  }

  /** الحذف يكرّر شروط «القابل لإعادة الكتابة» في where كي لا يمسّ ما تغيّر بين القراءة والكتابة */
  private async deleteRewritable(
    tx: Tx,
    seriesId: string,
    change: SeriesChange,
    now: Date,
  ): Promise<number> {
    if (!change.remove.length) return 0
    const { count } = await tx.booking.deleteMany({
      where: {
        id: { in: change.remove.map((b) => b.id) },
        recurringId: seriesId,
        status: BookingStatus.ACTIVE,
        recurringEdited: false,
        startAt: { gt: now },
      },
    })
    return count
  }

  private rowsFor(
    series: Pick<SeriesWithServices, 'id' | 'customerId' | 'notes' | 'createdById'>,
    planned: PlannedOccurrence[],
    ctx: Context,
  ): Prisma.BookingCreateManyInput[] {
    return planned.map((o) => {
      const service = ctx.rows.get(o.serviceId)!
      return {
        customerId: series.customerId,
        serviceId: o.serviceId,
        serviceName: service.name,
        price: service.price,
        durationMinutes: service.durationMinutes,
        startAt: o.startAt,
        endAt: o.endAt,
        notes: series.notes,
        createdById: series.createdById,
        recurringId: series.id,
        occurrenceDate: parseDateOnly(o.date),
      }
    })
  }

  private async insertIn(
    tx: Tx,
    series: Pick<SeriesWithServices, 'id' | 'customerId' | 'notes' | 'createdById'>,
    planned: PlannedOccurrence[],
    ctx: Context,
  ): Promise<number> {
    if (!planned.length) return 0
    const { count } = await tx.booking.createMany({
      data: this.rowsFor(series, planned, ctx),
      skipDuplicates: true,
    })
    return count
  }

  /**
   * إدراج المولَّد خارج معاملة: إن رفضت القاعدة الدفعة بسبب سباق تداخل نكمل صفاً صفاً
   * ونتخطّى ما تعارض (يُملأ لاحقاً في المزامنة إن تحرّر وقته).
   */
  private async insert(
    series: SeriesWithServices,
    planned: PlannedOccurrence[],
    ctx: Context,
  ): Promise<number> {
    if (!planned.length) return 0
    const data = this.rowsFor(series, planned, ctx)
    try {
      return (await this.prisma.booking.createMany({ data, skipDuplicates: true })).count
    } catch (error) {
      if (!isBookingOverlapError(error)) throw error
    }
    let created = 0
    for (const row of data) {
      try {
        await this.prisma.booking.create({ data: row })
        created++
      } catch (error) {
        if (!isBookingOverlapError(error) && !isUniqueViolation(error)) throw error
      }
    }
    return created
  }

  private async guardRace<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (isBookingOverlapError(error) || isUniqueViolation(error))
        throw new ConflictException(MSG_RACE)
      throw error
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
