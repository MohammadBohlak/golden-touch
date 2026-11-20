import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { BookingStatus, Prisma } from '@prisma/client'
import { paginated, PaginatedResponse } from '../../common/dto/pagination-query.dto'
import { isBookingOverlapError } from '../../common/filters/all-exceptions.filter'
import type { AuthUser } from '../../common/types/auth-user'
import { matchingIds, matchingValues } from '../../common/utils/name-search'
import { normalizePhone, phoneSearchFilters, phoneVariants } from '../../common/utils/phone'
import { addDays, addMinutes, dayRangeUtc, formatTime, toDateString } from '../../common/utils/time'
import { PrismaService } from '../../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { BLOCKING_STATUSES, bookingInclude, BookingWithRelations } from './booking.mapper'
import {
  assertCanReopen,
  BookingCaps,
  BookingView,
  buildDaySummary,
  capsOf,
  historyCutoff,
  MSG_NO_FINANCE,
  MSG_NO_HISTORY,
  MSG_NO_PAST_WRITE,
  resolveCompletion,
  toBookingView,
} from './booking.visibility'
import {
  AvailabilityQueryDto,
  BookingsQueryDto,
  CancelBookingDto,
  CompleteBookingDto,
  CreateBookingDto,
  UpdateBookingDto,
} from './dto/booking.dto'
import { blocksHardDelete } from '../recurring/recurrence'
import { dateOnly } from '../recurring/recurring.mapper'
import { computeGaps, computeSlots, Interval, shopWindow } from './schedule'

type Tx = Prisma.TransactionClient

const MSG_RECURRING_DELETE = 'هذا موعد من حجز دوري: ألغِه، أو أوقف الحجز الدوري ثم احذفه'
const NOT_ACTIVE = 'لا يمكن تعديل موعد حجز مكتمل أو ملغي — أعد فتحه أولاً'

/** ما يحدّده المستخدم: قدراته + أول لحظة يراها (null = يرى كل الماضي) */
interface Scope {
  caps: BookingCaps
  timezone: string
  cutoff: Date | null
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** نطاق رؤية المستخدم: من لا يملك bookings.history لا يرى ما قبل بداية اليوم (بتوقيت الصالون) */
  private async scopeOf(actor: AuthUser): Promise<Scope> {
    const { timezone } = await this.settings.get()
    const caps = capsOf(actor)
    return { caps, timezone, cutoff: caps.history ? null : historyCutoff(new Date(), timezone) }
  }

  /** حجز ضمن نطاق المستخدم؛ السابق يظهر له «غير موجود» (404) لا «ممنوع» كي لا يكشف وجوده */
  private async loadVisible(id: string, scope: Scope): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: bookingInclude })
    if (!booking || (scope.cutoff && booking.startAt < scope.cutoff)) {
      throw new NotFoundException('الحجز غير موجود')
    }
    return booking
  }

  // ───────────────────────── القراءة ─────────────────────────

  /** جدول يوم كامل: الحجوزات + الفراغات المتاحة + ملخص */
  async day(date: string, actor: AuthUser) {
    const settings = await this.settings.get()
    const caps = capsOf(actor)
    const now = new Date()
    if (!caps.history && date < toDateString(now, settings.timezone)) {
      throw new ForbiddenException(MSG_NO_HISTORY)
    }
    const window = shopWindow(date, settings)
    const calendar = dayRangeUtc(date, settings.timezone)
    const rangeStart = window.start < calendar.start ? window.start : calendar.start
    const rangeEnd = window.end > calendar.end ? window.end : calendar.end

    const bookings = await this.prisma.booking.findMany({
      where: { startAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { startAt: 'asc' },
      include: bookingInclude,
    })
    const blocking = bookings.filter((b) => b.status !== BookingStatus.CANCELLED)

    return {
      date,
      timezone: settings.timezone,
      slotMinutes: settings.slotMinutes,
      closed: window.closed,
      window: { start: window.start, end: window.end },
      now,
      bookings: bookings.map((b) => toBookingView(b, caps)),
      gaps: computeGaps({
        window,
        busy: blocking.map((b) => ({ start: b.startAt, end: b.endAt })),
        now,
      }),
      summary: buildDaySummary(bookings, caps),
    }
  }

  /** فترات البدء المتاحة لخدمة/مدة في يوم معيّن (فترات فقط — لا مال ولا تفاصيل حجوزات) */
  async availability(query: AvailabilityQueryDto) {
    const settings = await this.settings.get()
    let duration = query.durationMinutes
    if (!duration && query.serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: query.serviceId } })
      if (!service) throw new NotFoundException('الخدمة غير موجودة')
      duration = service.durationMinutes
    }
    duration ??= settings.slotMinutes

    const window = shopWindow(query.date, settings)
    const busy = await this.prisma.booking.findMany({
      where: {
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { lt: window.end },
        endAt: { gt: window.start },
        ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
      },
      select: { id: true, startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    })

    return {
      date: query.date,
      timezone: settings.timezone,
      closed: window.closed,
      durationMinutes: duration,
      stepMinutes: settings.slotMinutes,
      window: { start: window.start, end: window.end },
      slots: computeSlots({
        window,
        busy: busy.map((b) => ({ id: b.id, start: b.startAt, end: b.endAt })),
        durationMinutes: duration,
        stepMinutes: settings.slotMinutes,
        now: new Date(),
      }),
    }
  }

  async findAll(query: BookingsQueryDto, actor: AuthUser): Promise<PaginatedResponse<BookingView>> {
    const { caps, timezone, cutoff } = await this.scopeOf(actor)
    const where: Prisma.BookingWhereInput = {}
    if (query.status) where.status = query.status
    if (query.customerId) where.customerId = query.customerId
    if (query.recurringId) where.recurringId = query.recurringId

    // الحدّ الأدنى لا ينزل تحت cutoff مهما كانت معاملات الطلب (from/to/بدونهما)
    const requestedFrom = query.from ? dayRangeUtc(query.from, timezone).start : null
    const lowerBound = cutoff && (!requestedFrom || requestedFrom < cutoff) ? cutoff : requestedFrom
    if (lowerBound || query.to) {
      where.startAt = {
        ...(lowerBound ? { gte: lowerBound } : {}),
        ...(query.to ? { lt: dayRangeUtc(query.to, timezone).end } : {}),
      }
    }
    if (query.search) {
      const phoneFilters = phoneSearchFilters(query.search)
      // الأسماء بتوحيد الحروف العربية («احمد» تطابق «أحمد»)، والهاتف بكل صيغه (0 / 963 / +963)
      const [customerIds, serviceNames] = await Promise.all([
        matchingIds(this.prisma, 'customers', query.search),
        matchingValues(this.prisma, 'bookingServiceName', query.search),
      ])
      where.OR = [
        { customerId: { in: customerIds } },
        { serviceName: { in: serviceNames } },
        ...phoneFilters.map((phone) => ({ customer: { phone } })),
      ]
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { startAt: query.order ?? 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ])
    return paginated(
      items.map((b) => toBookingView(b, caps)),
      total,
      query,
    )
  }

  /** حجوزات انتهى وقتها وما زالت "قيد العمل" — المشرف يرى حجوزات اليوم فقط */
  async overdue(actor: AuthUser): Promise<BookingView[]> {
    const { caps, cutoff } = await this.scopeOf(actor)
    const items = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACTIVE,
        endAt: { lte: new Date() },
        ...(cutoff ? { startAt: { gte: cutoff } } : {}),
      },
      orderBy: { startAt: 'asc' },
      take: 50,
      include: bookingInclude,
    })
    return items.map((b) => toBookingView(b, caps))
  }

  async findOne(id: string, actor: AuthUser): Promise<BookingView> {
    const scope = await this.scopeOf(actor)
    return toBookingView(await this.loadVisible(id, scope), scope.caps)
  }

  // ───────────────────────── الكتابة ─────────────────────────

  async create(dto: CreateBookingDto, actor: AuthUser): Promise<BookingView> {
    const { caps, timezone, cutoff } = await this.scopeOf(actor)
    if (dto.price !== undefined && !caps.finance) throw new ForbiddenException(MSG_NO_FINANCE)
    const startAt = new Date(dto.startAt)
    if (cutoff && startAt < cutoff) throw new ForbiddenException(MSG_NO_PAST_WRITE)

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null },
    })
    if (!service) throw new NotFoundException('الخدمة غير موجودة')

    const durationMinutes = dto.durationMinutes ?? service.durationMinutes
    const endAt = addMinutes(startAt, durationMinutes)

    const created = await this.guardOverlap(() =>
      this.prisma.$transaction(async (tx) => {
        await this.assertNoOverlap(tx, { start: startAt, end: endAt }, timezone)
        const customerId = await this.resolveCustomer(tx, dto)
        return tx.booking.create({
          data: {
            customerId,
            serviceId: service.id,
            serviceName: service.name,
            price: dto.price ?? service.price,
            durationMinutes,
            startAt,
            endAt,
            notes: dto.notes || null,
            createdById: actor.id,
          },
          include: bookingInclude,
        })
      }),
    )
    return toBookingView(created, caps)
  }

  async update(id: string, dto: UpdateBookingDto, actor: AuthUser): Promise<BookingView> {
    const scope = await this.scopeOf(actor)
    const { caps, timezone, cutoff } = scope
    if ((dto.price !== undefined || dto.paidAmount !== undefined) && !caps.finance) {
      throw new ForbiddenException(MSG_NO_FINANCE)
    }
    if (cutoff && dto.startAt && new Date(dto.startAt) < cutoff) {
      throw new ForbiddenException(MSG_NO_PAST_WRITE)
    }
    const booking = await this.loadVisible(id, scope)
    const changesSchedule =
      dto.serviceId !== undefined ||
      dto.startAt !== undefined ||
      dto.durationMinutes !== undefined ||
      dto.customerId !== undefined ||
      dto.customerName !== undefined ||
      dto.price !== undefined
    if (changesSchedule && booking.status !== BookingStatus.ACTIVE) {
      throw new ConflictException(NOT_ACTIVE)
    }
    if (dto.paidAmount !== undefined && booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('المبلغ المدفوع يُعدَّل للحجوزات المكتملة فقط')
    }

    const data: Prisma.BookingUncheckedUpdateInput = {}
    // أي تعديل يدوي لموعد دوري يحميه من إعادة الكتابة عند تعديل السلسلة (D9)
    if (booking.recurringId) data.recurringEdited = true
    let durationMinutes = booking.durationMinutes
    if (dto.serviceId && dto.serviceId !== booking.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: dto.serviceId, archivedAt: null },
      })
      if (!service) throw new NotFoundException('الخدمة غير موجودة')
      data.serviceId = service.id
      data.serviceName = service.name
      data.price = service.price
      durationMinutes = service.durationMinutes
    }
    if (dto.durationMinutes !== undefined) durationMinutes = dto.durationMinutes
    if (dto.price !== undefined) data.price = dto.price
    if (dto.notes !== undefined) data.notes = dto.notes || null
    if (dto.paidAmount !== undefined) data.paidAmount = dto.paidAmount

    const startAt = dto.startAt ? new Date(dto.startAt) : booking.startAt
    const endAt = addMinutes(startAt, durationMinutes)
    const timeChanged =
      startAt.getTime() !== booking.startAt.getTime() || endAt.getTime() !== booking.endAt.getTime()
    if (timeChanged) Object.assign(data, { startAt, endAt, durationMinutes })

    const updated = await this.guardOverlap(() =>
      this.prisma.$transaction(async (tx) => {
        if (timeChanged)
          await this.assertNoOverlap(tx, { start: startAt, end: endAt }, timezone, id)
        if (dto.customerId !== undefined || dto.customerName !== undefined) {
          data.customerId = await this.resolveCustomer(tx, dto)
        }
        return tx.booking.update({ where: { id }, data, include: bookingInclude })
      }),
    )
    return toBookingView(updated, caps)
  }

  /**
   * إكمال الحجز. بلا مبلغ صريح يُسجَّل سعر الحجز تلقائياً (D11) — وهذا ما يفعله المشرف.
   * المبلغ الصريح للمدير فقط.
   */
  async complete(id: string, dto: CompleteBookingDto, actor: AuthUser): Promise<BookingView> {
    const scope = await this.scopeOf(actor)
    if (dto.paidAmount !== undefined && !scope.caps.finance) {
      throw new ForbiddenException(MSG_NO_FINANCE)
    }
    const booking = await this.loadVisible(id, scope)
    if (booking.status !== BookingStatus.ACTIVE) {
      throw new ConflictException('يمكن إكمال الحجوزات التي قيد العمل فقط')
    }
    const service = await this.prisma.service.findUnique({
      where: { id: booking.serviceId },
      select: { price: true },
    })
    const { paidAmount, price } = resolveCompletion(
      {
        bookingPrice: booking.price,
        servicePrice: service?.price ?? null,
        requested: dto.paidAmount,
      },
      scope.caps,
    )
    const completed = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.COMPLETED, paidAmount, price, completedAt: new Date() },
      include: bookingInclude,
    })
    return toBookingView(completed, scope.caps)
  }

  /** الإلغاء يحرّر مكان الحجز في الجدول فوراً */
  async cancel(id: string, dto: CancelBookingDto, actor: AuthUser): Promise<BookingView> {
    const scope = await this.scopeOf(actor)
    const booking = await this.loadVisible(id, scope)
    if (booking.status !== BookingStatus.ACTIVE) {
      throw new ConflictException('يمكن إلغاء الحجوزات التي قيد العمل فقط')
    }
    const cancelled = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason || null,
      },
      include: bookingInclude,
    })
    return toBookingView(cancelled, scope.caps)
  }

  /** إعادة حجز مكتمل/ملغي إلى "قيد العمل" (لتصحيح الأخطاء) */
  async reopen(id: string, actor: AuthUser): Promise<BookingView> {
    const scope = await this.scopeOf(actor)
    const booking = await this.loadVisible(id, scope)
    if (booking.status === BookingStatus.ACTIVE) return toBookingView(booking, scope.caps)
    assertCanReopen(booking, scope.caps)
    const reopened = await this.guardOverlap(() =>
      this.prisma.$transaction(async (tx) => {
        if (booking.status === BookingStatus.CANCELLED) {
          await this.assertNoOverlap(
            tx,
            { start: booking.startAt, end: booking.endAt },
            scope.timezone,
            id,
          )
        }
        return tx.booking.update({
          where: { id },
          data: {
            status: BookingStatus.ACTIVE,
            paidAmount: null,
            completedAt: null,
            cancelledAt: null,
            cancelReason: null,
          },
          include: bookingInclude,
        })
      }),
    )
    return toBookingView(reopened, scope.caps)
  }

  /**
   * الحذف النهائي (bookings.delete للمدير فقط) — لا نافذة زمنية هنا.
   * موعد دوري قادم لا يُحذف نهائياً ما دامت سلسلته تولّد (وإلا أعاد المولّد إنشاءه): يُلغى أو تُوقف السلسلة.
   */
  async remove(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        recurringId: true,
        occurrenceDate: true,
        recurring: { select: { stoppedAt: true, endDate: true } },
      },
    })
    if (!booking) throw new NotFoundException('الحجز غير موجود')
    if (booking.recurringId) {
      const { timezone } = await this.settings.get()
      const blocked = blocksHardDelete(
        {
          recurringId: booking.recurringId,
          occurrenceDate: booking.occurrenceDate ? dateOnly(booking.occurrenceDate) : null,
        },
        booking.recurring
          ? {
              stoppedAt: booking.recurring.stoppedAt,
              endDate: booking.recurring.endDate ? dateOnly(booking.recurring.endDate) : null,
            }
          : null,
        addDays(toDateString(new Date(), timezone), -1),
      )
      if (blocked) throw new ConflictException(MSG_RECURRING_DELETE)
    }
    await this.prisma.booking.delete({ where: { id } })
    return { success: true }
  }

  // ───────────────────────── مساعدات ─────────────────────────

  private async assertNoOverlap(tx: Tx, range: Interval, timezone: string, excludeId?: string) {
    const conflict = await tx.booking.findFirst({
      where: {
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { lt: range.end },
        endAt: { gt: range.start },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { startAt: 'asc' },
    })
    if (conflict) {
      const from = formatTime(conflict.startAt, timezone)
      const to = formatTime(conflict.endAt, timezone)
      const message = `هذا الوقت يتداخل مع حجز "${conflict.customer.name}" (${from} – ${to})`
      throw new ConflictException({ message, errors: { startAt: [message] } })
    }
  }

  /** زبون موجود بالمعرّف، أو بالهاتف، أو زبون جديد بالاسم */
  private async resolveCustomer(
    tx: Tx,
    dto: { customerId?: string; customerName?: string; customerPhone?: string },
  ): Promise<string> {
    if (dto.customerId) {
      const exists = await tx.customer.count({ where: { id: dto.customerId } })
      if (!exists) throw new NotFoundException('الزبون غير موجود')
      return dto.customerId
    }
    const name = dto.customerName?.trim()
    if (!name) {
      throw new BadRequestException({
        message: 'اسم الزبون مطلوب',
        errors: { customerName: ['اسم الزبون مطلوب'] },
      })
    }
    const phone = normalizePhone(dto.customerPhone)
    if (phone) {
      // الهاتف لم يعد فريداً: الأقدم تسجيلاً يُعاد استعماله (و0/963/+963 رقم واحد)
      const existing = await tx.customer.findFirst({
        where: { phone: { in: phoneVariants(phone) } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (existing) return existing.id
    }
    const created = await tx.customer.create({ data: { name, phone } })
    return created.id
  }

  /** قيد قاعدة البيانات (EXCLUDE) هو خط الدفاع الأخير ضد حجزين متزامنين لنفس الوقت */
  private async guardOverlap<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (isBookingOverlapError(error)) {
        throw new ConflictException('تم حجز هذا الوقت للتو من مستخدم آخر، اختر وقتاً مختلفاً')
      }
      throw error
    }
  }
}
