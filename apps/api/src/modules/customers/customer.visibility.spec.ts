import type { BookingCaps } from '../bookings/booking.visibility'
import { buildCustomerStats, needsCompletedAggregate } from './customer.visibility'

const ADMIN: BookingCaps = { finance: true, history: true }
const STAFF: BookingCaps = { finance: false, history: false }
const HISTORY_ONLY: BookingCaps = { finance: false, history: true }
const FINANCE_ONLY: BookingCaps = { finance: true, history: false }

const input = {
  upcoming: 2,
  completed: 7,
  totalSpent: 175000,
  lastVisitAt: new Date('2026-10-01T10:00:00Z'),
  cancelled: 3,
}

describe('buildCustomerStats', () => {
  it('المدير: كل شيء', () => {
    expect(buildCustomerStats(input, ADMIN)).toEqual({
      upcoming: 2,
      visits: 7,
      lastVisitAt: input.lastVisitAt,
      cancelled: 3,
      totalSpent: 175000,
    })
  })

  it('المشرف: القادمة فقط — لا مفاتيح للزيارات ولا للمال', () => {
    const stats = buildCustomerStats(input, STAFF)
    expect(stats).toEqual({ upcoming: 2 })
    for (const key of ['visits', 'lastVisitAt', 'cancelled', 'totalSpent']) {
      expect(stats).not.toHaveProperty(key)
    }
  })

  it('السجل بلا مال: زيارات وملغاة دون مجموع المدفوع', () => {
    const stats = buildCustomerStats(input, HISTORY_ONLY)
    expect(stats.visits).toBe(7)
    expect(stats).not.toHaveProperty('totalSpent')
  })

  it('المال بلا سجل: المجموع دون الزيارات', () => {
    const stats = buildCustomerStats(input, FINANCE_ONLY)
    expect(stats.totalSpent).toBe(175000)
    expect(stats).not.toHaveProperty('visits')
    expect(stats).not.toHaveProperty('cancelled')
  })
})

describe('needsCompletedAggregate', () => {
  it('لا حاجة لاستعلام المكتملة للمشرف', () => {
    expect(needsCompletedAggregate(STAFF)).toBe(false)
    expect(needsCompletedAggregate(HISTORY_ONLY)).toBe(true)
    expect(needsCompletedAggregate(FINANCE_ONLY)).toBe(true)
  })
})
