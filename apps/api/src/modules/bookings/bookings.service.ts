import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { BookingStatus, Prisma } from '@prisma/client'
import { paginated, PaginatedResponse } from '../../common/dto/pagination-query.dto'
import { isBookingOverlapError } from '../../common/filters/all-exceptions.filter'
import type { AuthUser } from '../../common/types/auth-user'
import { normalizePhone } from '../../common/utils/phone'
import { addMinutes, dayRangeUtc, formatTime } from '../../common/utils/time'
import { PrismaService } from '../../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { BLOCKING_STATUSES, bookingInclude, BookingWithRelations } from './booking.mapper'
import {
  AvailabilityQueryDto,
  BookingsQueryDto,
  CancelBookingDto,
  CompleteBookingDto,
  CreateBookingDto,
  UpdateBookingDto,
} from './dto/booking.dto'
import { computeGaps, computeSlots, Interval, shopWindow } from './schedule'

type Tx = Prisma.TransactionClient

const NOT_ACTIVE = 'لا يمكن تعديل موعد حجز مكتمل أو ملغي — أعد فتحه أولاً'

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ───────────────────────── القراءة ─────────────────────────

  /** جدول يوم كامل: الحجوزات + الفراغات المتاحة + ملخص */
  async day(date: string) {
    const settings = await this.settings.get()
    const window = shopWindow(date, settings)
    const calendar = dayRangeUtc(date, settings.timezone)
    const rangeStart = window.start < calendar.start ? window.start : calendar.start
    const rangeEnd = window.end > calendar.end ? window.end : calendar.end
    const now = new Date()

    const bookings = await this.prisma.booking.findMany({
      where: { startAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { startAt: 'asc' },
      include: bookingInclude,
    })
    const blocking = bookings.filter((b) => b.status !== BookingStatus.CANCELLED)
    const completed = bookings.filter((b) => b.status === BookingStatus.COMPLETED)
    const active = bookings.filter((b) => b.status === BookingStatus.ACTIVE)

    return {
      date,
      timezone: settings.timezone,
      slotMinutes: settings.slotMinutes,
      closed: window.closed,
      window: { start: window.start, end: window.end },
      now,
      bookings,
      gaps: computeGaps({
        window,
        busy: blocking.map((b) => ({ start: b.startAt, end: b.endAt })),
        now,
      }),
      summary: {
        total: blocking.length,
        active: active.length,
        completed: completed.length,
        cancelled: bookings.length - blocking.length,
        revenue: completed.reduce((sum, b) => sum + (b.paidAmount ?? 0), 0),
        expected: active.reduce((sum, b) => sum + b.price, 0),
      },
    }
  }

  /** فترات البدء المتاحة لخدمة/مدة في يوم معيّن */
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

  async findAll(query: BookingsQueryDto): Promise<PaginatedResponse<BookingWithRelations>> {
    const settings = await this.settings.get()
    const where: Prisma.BookingWhereInput = {}
    if (query.status) where.status = query.status
    if (query.customerId) where.customerId = query.customerId
    if (query.from || query.to) {
      where.startAt = {
        ...(query.from ? { gte: dayRangeUtc(query.from, settings.timezone).start } : {}),
        ...(query.to ? { lt: dayRangeUtc(query.to, settings.timezone).end } : {}),
      }
    }
    if (query.search) {
      const phone = normalizePhone(query.search)
      where.OR = [
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { serviceName: { contains: query.search, mode: 'insensitive' } },
        ...(phone ? [{ customer: { phone: { contains: phone } } }] : []),
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
    return paginated(items, total, query)
  }

  /** حجوزات انتهى وقتها وما زالت "قيد العمل" — تحتاج إكمالاً أو إلغاءً */
  overdue() {
    return this.prisma.booking.findMany({
      where: { status: BookingStatus.ACTIVE, endAt: { lte: new Date() } },
      orderBy: { startAt: 'asc' },
      take: 50,
      include: bookingInclude,
    })
  }

  async findOne(id: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: bookingInclude })
    if (!booking) throw new NotFoundException('الحجز غير موجود')
    return booking
  }

  // ───────────────────────── الكتابة ─────────────────────────

  async create(dto: CreateBookingDto, actor: AuthUser): Promise<BookingWithRelations> {
    const timezone = (await this.settings.get()).timezone
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null },
    })
    if (!service) throw new NotFoundException('الخدمة غير موجودة')

    const durationMinutes = dto.durationMinutes ?? service.durationMinutes
    const startAt = new Date(dto.startAt)
    const endAt = addMinutes(startAt, durationMinutes)

    return this.guardOverlap(() =>
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
  }

  async update(id: string, dto: UpdateBookingDto): Promise<BookingWithRelations> {
    const booking = await this.findOne(id)
    const timezone = (await this.settings.get()).timezone
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

    return this.guardOverlap(() =>
      this.prisma.$transaction(async (tx) => {
        if (timeChanged)
          await this.assertNoOverlap(tx, { start: startAt, end: endAt }, timezone, id)
        if (dto.customerId !== undefined || dto.customerName !== undefined) {
          data.customerId = await this.resolveCustomer(tx, dto)
        }
        return tx.booking.update({ where: { id }, data, include: bookingInclude })
      }),
    )
  }

  async complete(id: string, dto: CompleteBookingDto): Promise<BookingWithRelations> {
    const booking = await this.findOne(id)
    if (booking.status !== BookingStatus.ACTIVE) {
      throw new ConflictException('يمكن إكمال الحجوزات التي قيد العمل فقط')
    }
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.COMPLETED,
        paidAmount: dto.paidAmount,
        completedAt: new Date(),
      },
      include: bookingInclude,
    })
  }

  /** الإلغاء يحرّر مكان الحجز في الجدول فوراً */
  async cancel(id: string, dto: CancelBookingDto): Promise<BookingWithRelations> {
    const booking = await this.findOne(id)
    if (booking.status !== BookingStatus.ACTIVE) {
      throw new ConflictException('يمكن إلغاء الحجوزات التي قيد العمل فقط')
    }
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason || null,
      },
      include: bookingInclude,
    })
  }

  /** إعادة حجز مكتمل/ملغي إلى "قيد العمل" (لتصحيح الأخطاء) */
  async reopen(id: string): Promise<BookingWithRelations> {
    const booking = await this.findOne(id)
    if (booking.status === BookingStatus.ACTIVE) return booking
    const timezone = (await this.settings.get()).timezone
    return this.guardOverlap(() =>
      this.prisma.$transaction(async (tx) => {
        if (booking.status === BookingStatus.CANCELLED) {
          await this.assertNoOverlap(
            tx,
            { start: booking.startAt, end: booking.endAt },
            timezone,
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
  }

  async remove(id: string) {
    await this.findOne(id)
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
      const existing = await tx.customer.findUnique({ where: { phone } })
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
