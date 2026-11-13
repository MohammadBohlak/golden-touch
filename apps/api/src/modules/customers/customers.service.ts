import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { BookingStatus, Prisma } from '@prisma/client'
import {
  paginated,
  PaginatedResponse,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto'
import type { AuthUser } from '../../common/types/auth-user'
import { normalizePhone } from '../../common/utils/phone'
import { PrismaService } from '../../prisma/prisma.service'
import { bookingInclude } from '../bookings/booking.mapper'
import { capsOf, historyCutoff, toBookingView } from '../bookings/booking.visibility'
import { SettingsService } from '../settings/settings.service'
import {
  buildCustomerStats,
  CustomerListItem,
  needsCompletedAggregate,
} from './customer.visibility'
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto'

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** الزيارات وآخر زيارة مشتقة من الحجوزات المكتملة (سجل سابق) → لمن يملك bookings.history فقط */
  async findAll(
    query: PaginationQueryDto,
    actor: AuthUser,
  ): Promise<PaginatedResponse<CustomerListItem>> {
    const { history } = capsOf(actor)
    const search = query.search
    const phone = normalizePhone(search)
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            ...(phone ? [{ phone: { contains: phone } }] : []),
          ],
        }
      : {}

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: query.skip,
        take: query.limit,
        include: {
          _count: { select: { bookings: { where: { status: BookingStatus.COMPLETED } } } },
        },
      }),
      this.prisma.customer.count({ where }),
    ])

    const basic = ({ id, name, phone, notes, createdAt }: (typeof customers)[number]) => ({
      id,
      name,
      phone,
      notes,
      createdAt,
    })
    if (!history) return paginated(customers.map(basic), total, query)

    const lastVisits = customers.length
      ? await this.prisma.booking.groupBy({
          by: ['customerId'],
          where: {
            customerId: { in: customers.map((c) => c.id) },
            status: BookingStatus.COMPLETED,
          },
          _max: { startAt: true },
        })
      : []
    const lastByCustomer = new Map(lastVisits.map((v) => [v.customerId, v._max.startAt]))

    const items = customers.map((customer) => ({
      ...basic(customer),
      visits: customer._count.bookings,
      lastVisitAt: lastByCustomer.get(customer.id) ?? null,
    }))
    return paginated(items, total, query)
  }

  /**
   * ملف الزبون. من لا يملك bookings.history لا يرى إلا الحجوزات من بداية اليوم فصاعداً
   * ولا زيارات ولا ملغاة؛ ومن لا يملك finance.read لا يستلم مجموع المدفوع ولا أسعار الحجوزات.
   */
  async findOne(id: string, actor: AuthUser) {
    const caps = capsOf(actor)
    const { timezone } = await this.settings.get()
    const cutoff = caps.history ? null : historyCutoff(new Date(), timezone)

    const customer = await this.prisma.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException('الزبون غير موجود')

    const [completed, cancelled, upcoming, recent] = await Promise.all([
      needsCompletedAggregate(caps)
        ? this.prisma.booking.aggregate({
            where: { customerId: id, status: BookingStatus.COMPLETED },
            _count: true,
            _sum: { paidAmount: true },
            _max: { startAt: true },
          })
        : null,
      caps.history
        ? this.prisma.booking.count({ where: { customerId: id, status: BookingStatus.CANCELLED } })
        : 0,
      this.prisma.booking.count({
        where: { customerId: id, status: BookingStatus.ACTIVE, startAt: { gte: new Date() } },
      }),
      this.prisma.booking.findMany({
        where: { customerId: id, ...(cutoff ? { startAt: { gte: cutoff } } : {}) },
        // السجل: الأحدث أولاً. من يرى القادم فقط: الأقرب موعداً أولاً
        orderBy: { startAt: cutoff ? 'asc' : 'desc' },
        take: 30,
        include: bookingInclude,
      }),
    ])

    return {
      ...customer,
      stats: buildCustomerStats(
        {
          upcoming,
          completed: completed?._count ?? 0,
          totalSpent: completed?._sum.paidAmount ?? 0,
          lastVisitAt: completed?._max.startAt ?? null,
          cancelled,
        },
        caps,
      ),
      bookings: recent.map((b) => toBookingView(b, caps)),
    }
  }

  async create(dto: CreateCustomerDto) {
    const phone = normalizePhone(dto.phone)
    await this.assertPhoneFree(phone)
    return this.prisma.customer.create({
      data: { name: dto.name, phone, notes: dto.notes || null },
    })
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(id)
    const phone = dto.phone === undefined ? undefined : normalizePhone(dto.phone)
    if (phone) await this.assertPhoneFree(phone, id)
    return this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone,
        notes: dto.notes === undefined ? undefined : dto.notes || null,
      },
    })
  }

  async remove(id: string) {
    await this.ensureExists(id)
    const bookings = await this.prisma.booking.count({ where: { customerId: id } })
    if (bookings > 0) {
      throw new ConflictException('لا يمكن حذف زبون لديه حجوزات مسجّلة')
    }
    if (await this.prisma.recurringBooking.count({ where: { customerId: id } })) {
      throw new ConflictException('لا يمكن حذف زبون لديه حجز دوري مسجّل')
    }
    await this.prisma.customer.delete({ where: { id } })
    return { success: true }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.customer.count({ where: { id } })
    if (!exists) throw new NotFoundException('الزبون غير موجود')
  }

  private async assertPhoneFree(phone: string | null, excludeId?: string) {
    if (!phone) return
    const owner = await this.prisma.customer.findUnique({ where: { phone } })
    if (owner && owner.id !== excludeId) {
      throw new ConflictException({
        message: `رقم الهاتف مسجّل مسبقاً للزبون "${owner.name}"`,
        errors: { phone: ['رقم الهاتف مسجّل مسبقاً'] },
      })
    }
  }
}
