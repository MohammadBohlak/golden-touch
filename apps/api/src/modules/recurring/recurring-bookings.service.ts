import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import type { AuthUser } from '../../common/types/auth-user'
import { toDateString } from '../../common/utils/time'
import { PrismaService } from '../../prisma/prisma.service'
import { bookingInclude } from '../bookings/booking.mapper'
import { BookingView, capsOf, toBookingView } from '../bookings/booking.visibility'
import { SettingsService } from '../settings/settings.service'
import {
  CreateRecurringDto,
  PreviewRecurringDto,
  RecurringQueryDto,
  UpdateRecurringDto,
} from './dto/recurring.dto'
import { OccurrenceIssue, SeriesTemplate } from './recurrence'
import { dateOnly, parseDateOnly, toTemplate } from './recurring.mapper'
import { RecurringService, TemplatePatch } from './recurring.service'
import {
  FieldErrors,
  firstOccurrenceProblem,
  MSG_STOPPED,
  validateTemplate,
} from './recurring.validation'
import {
  NextOccurrence,
  SeriesRow,
  seriesInclude,
  seriesStatus,
  SeriesView,
  toSeriesView,
} from './recurring.view'

/** تفاصيل سلسلة: القالب + مواعيدها القادمة (حجوزات عادية: المال لمن يملك finance.read فقط) */
export type SeriesDetail = SeriesView & { upcoming: BookingView[] }

export interface SeriesMutation {
  series: SeriesDetail
  created: number
  removed: number
  keptEdited: number
}

export interface SeriesPreview {
  occurrences: {
    date: string
    startAt: Date
    endAt: Date
    serviceId: string
    serviceName: string
  }[]
  issues: OccurrenceIssue[]
  /** مواعيد قائمة ستُحذف (عند التعديل) */
  removeCount: number
  /** مواعيد قادمة عُدّلت يدوياً وستبقى */
  keptEdited: number
}

const UPCOMING_LIMIT = 60

const fail = (errors: FieldErrors, status: 400 | 409 = 400): never => {
  const message = Object.values(errors)[0][0]
  const body = { message, errors }
  throw status === 409 ? new ConflictException(body) : new BadRequestException(body)
}

/**
 * واجهة الحجوزات الدورية: قراءة وإنشاء وتعديل وإيقاف ومعاينة. التوليد نفسه في RecurringService.
 * لا مال في القالب؛ والحجوزات المرفقة تمرّ بـ toBookingView (المال لمن يملك finance.read).
 */
@Injectable()
export class RecurringBookingsService {
  private readonly logger = new Logger(RecurringBookingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly engine: RecurringService,
  ) {}

  // ───────────────────────── القراءة ─────────────────────────

  async list(query: RecurringQueryDto, now: Date = new Date()): Promise<SeriesView[]> {
    const rows = await this.prisma.recurringBooking.findMany({
      where: {
        ...(query.includeStopped ? {} : { stoppedAt: null }),
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: seriesInclude,
      orderBy: { createdAt: 'desc' },
    })
    const views = await this.viewsOf(rows, now)
    return query.includeStopped ? views : views.filter((v) => v.status === 'ACTIVE')
  }

  async findOne(id: string, actor: AuthUser, now: Date = new Date()): Promise<SeriesDetail> {
    const row = await this.prisma.recurringBooking.findUnique({
      where: { id },
      include: seriesInclude,
    })
    if (!row) throw new NotFoundException('الحجز الدوري غير موجود')
    return this.detail(row, actor, now)
  }

  // ───────────────────────── المعاينة ─────────────────────────

  /** بلا أي كتابة. بلا seriesId = سلسلة جديدة، ومعه = أثر تطبيق الحقول المرسلة على سلسلة قائمة */
  async preview(dto: PreviewRecurringDto, now: Date = new Date()): Promise<SeriesPreview> {
    const base = dto.seriesId ? await this.existingTemplate(dto.seriesId) : undefined
    if (!base) {
      const missing: FieldErrors = {}
      if (!dto.startDate) missing.startDate = ['تاريخ البداية مطلوب']
      if (!dto.startTime) missing.startTime = ['الوقت مطلوب']
      if (!dto.serviceIds?.length) missing.serviceIds = ['اختر الخدمة']
      if (Object.keys(missing).length) fail(missing)
    }
    const template: SeriesTemplate = {
      startDate: dto.startDate ?? base!.startDate,
      startTime: dto.startTime ?? base!.startTime,
      intervalWeeks: dto.intervalWeeks ?? base?.intervalWeeks ?? 1,
      endDate: dto.endDate === undefined ? (base?.endDate ?? null) : dto.endDate,
      serviceIds: dto.serviceIds ?? base!.serviceIds,
      stopped: false,
    }
    const ctx = await this.engine.loadContext(template.serviceIds, now)
    this.assertValid(template, ctx.services, ctx.hours.timezone, now, dto.startDate !== undefined)

    const change = await this.engine.preview(template, dto.seriesId, now)
    const names = new Map(ctx.services.map((s) => [s.id, s.name]))
    return {
      occurrences: change.create.map((o) => ({
        date: o.date,
        startAt: o.startAt,
        endAt: o.endAt,
        serviceId: o.serviceId,
        serviceName: names.get(o.serviceId) ?? '—',
      })),
      issues: change.issues,
      removeCount: change.remove.length,
      keptEdited: change.keptEdited,
    }
  }

  // ───────────────────────── الكتابة ─────────────────────────

  async create(
    dto: CreateRecurringDto,
    actor: AuthUser,
    now: Date = new Date(),
  ): Promise<SeriesMutation> {
    if (!(await this.prisma.customer.count({ where: { id: dto.customerId } }))) {
      throw new NotFoundException('الزبون غير موجود')
    }
    const template: SeriesTemplate = {
      startDate: dto.startDate,
      startTime: dto.startTime,
      intervalWeeks: dto.intervalWeeks ?? 1,
      endDate: dto.endDate ?? null,
      serviceIds: dto.serviceIds,
      stopped: false,
    }
    const ctx = await this.engine.loadContext(template.serviceIds, now)
    this.assertValid(template, ctx.services, ctx.hours.timezone, now, true)

    // الموعد الأول يجب أن يتحقق فعلاً، وإلا لا نُنشئ سلسلة صامتة
    const change = await this.engine.preview(template, undefined, now)
    const problem = firstOccurrenceProblem(template.startDate, ctx.to, change)
    if (problem) fail({ [problem.field]: [problem.message] }, problem.status)

    const created = await this.prisma.recurringBooking.create({
      data: {
        customerId: dto.customerId,
        startTime: template.startTime,
        startDate: parseDateOnly(template.startDate),
        intervalWeeks: template.intervalWeeks,
        endDate: template.endDate ? parseDateOnly(template.endDate) : null,
        notes: dto.notes || null,
        createdById: actor.id,
        services: {
          create: template.serviceIds.map((serviceId, position) => ({ serviceId, position })),
        },
      },
      select: { id: true },
    })

    // فشل التوليد لا يُسقط الطلب: السلسلة محفوظة وتسدّ المزامنة الدورية الفراغ لاحقاً
    let generated = 0
    try {
      generated = (await this.engine.generate(created.id, now)).created
    } catch (error) {
      this.logger.warn(
        `Recurring generate failed: ${error instanceof Error ? error.message : error}`,
      )
    }
    return {
      series: await this.findOne(created.id, actor, now),
      created: generated,
      removed: 0,
      keptEdited: 0,
    }
  }

  async update(
    id: string,
    dto: UpdateRecurringDto,
    actor: AuthUser,
    now: Date = new Date(),
  ): Promise<SeriesMutation> {
    const series = await this.engine.loadSeries(id)
    if (series.stoppedAt) throw new ConflictException(MSG_STOPPED)
    if (dto.customerId && !(await this.prisma.customer.count({ where: { id: dto.customerId } }))) {
      throw new NotFoundException('الزبون غير موجود')
    }

    const patch: TemplatePatch = {
      customerId: dto.customerId,
      startDate: dto.startDate,
      startTime: dto.startTime,
      intervalWeeks: dto.intervalWeeks,
      endDate: dto.endDate,
      serviceIds: dto.serviceIds,
      notes: dto.notes === undefined ? undefined : dto.notes || null,
    }
    const current = toTemplate(series)
    const merged: SeriesTemplate = {
      ...current,
      ...(patch.startDate !== undefined && { startDate: patch.startDate }),
      ...(patch.startTime !== undefined && { startTime: patch.startTime }),
      ...(patch.intervalWeeks !== undefined && { intervalWeeks: patch.intervalWeeks }),
      ...(patch.endDate !== undefined && { endDate: patch.endDate }),
      ...(patch.serviceIds !== undefined && { serviceIds: patch.serviceIds }),
    }
    const ctx = await this.engine.loadContext(merged.serviceIds, now)
    this.assertValid(merged, ctx.services, ctx.hours.timezone, now, patch.startDate !== undefined)

    const result = await this.engine.replaceFuture(id, patch, now)
    return {
      series: await this.findOne(id, actor, now),
      created: result.created,
      removed: result.removed,
      keptEdited: result.keptEdited,
    }
  }

  async stop(id: string, actor: AuthUser, now: Date = new Date()): Promise<SeriesMutation> {
    const result = await this.engine.stop(id, now)
    return {
      series: await this.findOne(id, actor, now),
      created: 0,
      removed: result.removed,
      keptEdited: result.keptEdited,
    }
  }

  // ───────────────────────── مساعدات ─────────────────────────

  private async existingTemplate(id: string): Promise<SeriesTemplate> {
    const series = await this.engine.loadSeries(id)
    if (series.stoppedAt) throw new ConflictException(MSG_STOPPED)
    return toTemplate(series)
  }

  private assertValid(
    template: SeriesTemplate,
    services: { id: string; available: boolean }[],
    timezone: string,
    now: Date,
    checkStartRange: boolean,
  ): void {
    const errors = validateTemplate({
      template,
      availableServiceIds: new Set(services.filter((s) => s.available).map((s) => s.id)),
      today: toDateString(now, timezone),
      checkStartRange,
    })
    if (Object.keys(errors).length) fail(errors)
  }

  private async detail(row: SeriesRow, actor: AuthUser, now: Date): Promise<SeriesDetail> {
    const [view] = await this.viewsOf([row], now)
    const upcoming = await this.prisma.booking.findMany({
      where: { recurringId: row.id, endAt: { gt: now } },
      orderBy: { startAt: 'asc' },
      take: UPCOMING_LIMIT,
      include: bookingInclude,
    })
    const caps = capsOf(actor)
    return { ...view, upcoming: upcoming.map((b) => toBookingView(b, caps)) }
  }

  /** عروض عدة سلاسل بأقل استعلامات: أسماء الخدمات، المواعيد التالية، والمشكلات (إعادة تخطيط بلا كتابة) */
  private async viewsOf(rows: SeriesRow[], now: Date): Promise<SeriesView[]> {
    if (!rows.length) return []
    const { timezone } = await this.settings.get()
    const today = toDateString(now, timezone)
    const serviceIds = [...new Set(rows.flatMap((r) => r.services.map((s) => s.serviceId)))]

    const [services, nexts, { plans }] = await Promise.all([
      this.prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true, durationMinutes: true },
      }),
      this.prisma.booking.findMany({
        where: {
          recurringId: { in: rows.map((r) => r.id) },
          status: BookingStatus.ACTIVE,
          endAt: { gt: now },
        },
        orderBy: { startAt: 'asc' },
        select: { recurringId: true, startAt: true, serviceName: true, occurrenceDate: true },
      }),
      this.engine.fillPlans(
        rows.filter((r) => seriesStatus(r, today) === 'ACTIVE'),
        now,
      ),
    ])

    const names = new Map(services.map((s) => [s.id, s]))
    const nextOf = new Map<string, NextOccurrence>()
    for (const n of nexts) {
      if (!n.recurringId || nextOf.has(n.recurringId)) continue
      nextOf.set(n.recurringId, {
        date: n.occurrenceDate ? dateOnly(n.occurrenceDate) : toDateString(n.startAt, timezone),
        startAt: n.startAt,
        serviceName: n.serviceName,
      })
    }
    return rows.map((row) =>
      toSeriesView(row, {
        today,
        services: names,
        next: nextOf.get(row.id) ?? null,
        issues: plans.get(row.id)?.issues ?? [],
      }),
    )
  }
}
