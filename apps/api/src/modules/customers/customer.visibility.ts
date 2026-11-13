/**
 * رؤية بيانات الزبون حسب الصلاحيات — منطق نقي (docs/STAFF_RESTRICTIONS_PLAN.md، D8).
 *  - bookings.history: الزيارات وآخر زيارة وعدد الملغاة وسجل الحجوزات السابقة.
 *  - finance.read:    مجموع ما دفعه الزبون.
 * من لا يملك أياً منهما يرى الاسم والهاتف والملاحظات والحجوزات القادمة فقط.
 */
import type { BookingCaps } from '../bookings/booking.visibility'

export interface CustomerListItem {
  id: string
  name: string
  phone: string | null
  notes: string | null
  createdAt: Date
  /** غائبان عمّن لا يملك bookings.history */
  visits?: number
  lastVisitAt?: Date | null
}

export interface CustomerStats {
  /** حجوزات قادمة قيد العمل — مسموحة للجميع */
  upcoming: number
  visits?: number
  lastVisitAt?: Date | null
  cancelled?: number
  totalSpent?: number
}

export interface CustomerStatsInput {
  upcoming: number
  completed: number
  totalSpent: number
  lastVisitAt: Date | null
  cancelled: number
}

/** هل يحتاج الحساب استعلام الحجوزات المكتملة (للزيارات أو المجموع)؟ */
export function needsCompletedAggregate(caps: BookingCaps): boolean {
  return caps.history || caps.finance
}

export function buildCustomerStats(input: CustomerStatsInput, caps: BookingCaps): CustomerStats {
  const stats: CustomerStats = { upcoming: input.upcoming }
  if (caps.history) {
    stats.visits = input.completed
    stats.lastVisitAt = input.lastVisitAt
    stats.cancelled = input.cancelled
  }
  if (caps.finance) stats.totalSpent = input.totalSpent
  return stats
}
