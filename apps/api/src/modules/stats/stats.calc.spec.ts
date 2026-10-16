import { BookingStatus } from '@prisma/client'
import {
  bucketKey,
  computeSeries,
  computeTotals,
  pickGranularity,
  rankCustomers,
  StatsBooking,
} from './stats.calc'

const TZ = 'Asia/Damascus'

function booking(overrides: Partial<StatsBooking>): StatsBooking {
  return {
    customerId: 'c1',
    serviceId: 's1',
    serviceName: 'شعر',
    status: BookingStatus.COMPLETED,
    price: 20000,
    paidAmount: 20000,
    startAt: new Date('2026-10-16T10:00:00Z'),
    endAt: new Date('2026-10-16T10:30:00Z'),
    ...overrides,
  }
}

describe('stats calc', () => {
  const data = [
    booking({}),
    booking({ customerId: 'c2', paidAmount: 30000, endAt: new Date('2026-10-16T11:00:00Z') }),
    booking({
      customerId: 'c1',
      startAt: new Date('2026-10-17T09:00:00Z'),
      endAt: new Date('2026-10-17T09:30:00Z'),
    }),
    booking({ customerId: 'c3', status: BookingStatus.CANCELLED, paidAmount: null }),
    booking({ customerId: 'c3', status: BookingStatus.ACTIVE, paidAmount: null }),
  ]

  it('computes totals from completed bookings only', () => {
    expect(computeTotals(data)).toEqual({
      bookings: 4,
      completed: 3,
      active: 1,
      cancelled: 1,
      customers: 2,
      revenue: 70000,
      workMinutes: 30 + 60 + 30,
      avgTicket: 23333,
      cancellationRate: 20,
    })
  })

  it('ranks top customers by visits then spending', () => {
    expect(rankCustomers(data)).toEqual([
      { customerId: 'c1', visits: 2, spent: 40000 },
      { customerId: 'c2', visits: 1, spent: 30000 },
    ])
  })

  it('picks a readable granularity', () => {
    expect(pickGranularity('2026-10-01', '2026-10-31')).toBe('day')
    expect(pickGranularity('2026-07-01', '2026-10-31')).toBe('week')
    expect(pickGranularity('2026-01-01', '2026-12-31')).toBe('month')
  })

  it('buckets weeks starting on Saturday', () => {
    expect(bucketKey('2026-10-16', 'week')).toBe('2026-10-10') // جمعة → السبت السابق
    expect(bucketKey('2026-10-17', 'week')).toBe('2026-10-17') // سبت
    expect(bucketKey('2026-10-16', 'month')).toBe('2026-10-01')
  })

  it('fills empty days with zeros', () => {
    const series = computeSeries(data, '2026-10-15', '2026-10-17', TZ)
    expect(series.granularity).toBe('day')
    expect(series.points).toEqual([
      { key: '2026-10-15', revenue: 0, completed: 0 },
      { key: '2026-10-16', revenue: 50000, completed: 2 },
      { key: '2026-10-17', revenue: 20000, completed: 1 },
    ])
  })
})
