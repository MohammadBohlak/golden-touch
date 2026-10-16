import { BadRequestException, Injectable } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import { addDays, dayRangeUtc, diffDays } from '../../common/utils/time'
import { PrismaService } from '../../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import {
  computeDistribution,
  computeSeries,
  computeTotals,
  rankCustomers,
  rankServices,
  StatsBooking,
} from './stats.calc'

const MAX_RANGE_DAYS = 3 * 366

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async summary(from: string, to: string) {
    const days = diffDays(from, to) + 1
    if (days < 1) {
      throw new BadRequestException({
        message: 'تاريخ البداية يجب أن يسبق تاريخ النهاية',
        errors: { to: ['تاريخ النهاية قبل تاريخ البداية'] },
      })
    }
    if (days > MAX_RANGE_DAYS) throw new BadRequestException('الفترة طويلة جداً (الحد 3 سنوات)')

    const { timezone } = await this.settings.get()
    const previousTo = addDays(from, -1)
    const previousFrom = addDays(from, -days)

    const [current, previous] = await Promise.all([
      this.load(from, to, timezone),
      this.load(previousFrom, previousTo, timezone),
    ])

    const top = rankCustomers(current)
    const customers = top.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: top.map((c) => c.customerId) } },
          select: { id: true, name: true, phone: true },
        })
      : []
    const byId = new Map(customers.map((c) => [c.id, c]))

    return {
      range: { from, to, days },
      previousRange: { from: previousFrom, to: previousTo },
      totals: computeTotals(current),
      previous: computeTotals(previous),
      series: computeSeries(current, from, to, timezone),
      ...computeDistribution(current, timezone),
      topCustomers: top.map((c) => ({ ...c, customer: byId.get(c.customerId) ?? null })),
      topServices: rankServices(current),
    }
  }

  private load(from: string, to: string, timezone: string): Promise<StatsBooking[]> {
    return this.prisma.booking.findMany({
      where: {
        startAt: { gte: dayRangeUtc(from, timezone).start, lt: dayRangeUtc(to, timezone).end },
        status: { in: [BookingStatus.ACTIVE, BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
      },
      select: {
        customerId: true,
        serviceId: true,
        serviceName: true,
        status: true,
        price: true,
        paidAmount: true,
        startAt: true,
        endAt: true,
      },
    })
  }
}
