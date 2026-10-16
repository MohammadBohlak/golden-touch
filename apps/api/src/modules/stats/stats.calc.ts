/**
 * حساب الإحصائيات كدوال نقية فوق قائمة حجوزات الفترة.
 * حجم بيانات صالون واحد صغير (عشرات الحجوزات يومياً) فالتجميع في الذاكرة أبسط وأوضح من SQL معقد.
 */
import { BookingStatus } from '@prisma/client'
import {
  addDays,
  diffDays,
  MINUTE_MS,
  toDateString,
  weekdayOf,
  zonedParts,
} from '../../common/utils/time'

export interface StatsBooking {
  customerId: string
  serviceId: string
  serviceName: string
  status: BookingStatus
  price: number
  paidAmount: number | null
  startAt: Date
  endAt: Date
}

export type Granularity = 'day' | 'week' | 'month'

export interface Totals {
  /** كل الحجوزات غير الملغاة */
  bookings: number
  completed: number
  active: number
  cancelled: number
  /** عدد الزبائن المختلفين الذين أُنجزت لهم خدمة */
  customers: number
  revenue: number
  workMinutes: number
  avgTicket: number
  cancellationRate: number
}

export interface SeriesPoint {
  key: string
  revenue: number
  completed: number
}

const minutesOf = (b: StatsBooking) =>
  Math.round((b.endAt.getTime() - b.startAt.getTime()) / MINUTE_MS)

export function computeTotals(bookings: StatsBooking[]): Totals {
  const completed = bookings.filter((b) => b.status === BookingStatus.COMPLETED)
  const cancelled = bookings.filter((b) => b.status === BookingStatus.CANCELLED).length
  const active = bookings.filter((b) => b.status === BookingStatus.ACTIVE).length
  const revenue = completed.reduce((sum, b) => sum + (b.paidAmount ?? 0), 0)
  return {
    bookings: bookings.length - cancelled,
    completed: completed.length,
    active,
    cancelled,
    customers: new Set(completed.map((b) => b.customerId)).size,
    revenue,
    workMinutes: completed.reduce((sum, b) => sum + minutesOf(b), 0),
    avgTicket: completed.length ? Math.round(revenue / completed.length) : 0,
    cancellationRate: bookings.length ? Math.round((cancelled / bookings.length) * 1000) / 10 : 0,
  }
}

export function pickGranularity(from: string, to: string): Granularity {
  const days = diffDays(from, to) + 1
  if (days <= 31) return 'day'
  if (days <= 180) return 'week'
  return 'month'
}

/** مفتاح الفترة: اليوم نفسه، أو سبت بداية الأسبوع، أو أول الشهر */
export function bucketKey(date: string, granularity: Granularity): string {
  if (granularity === 'day') return date
  if (granularity === 'month') return `${date.slice(0, 7)}-01`
  const sinceSaturday = (weekdayOf(date) + 1) % 7
  return addDays(date, -sinceSaturday)
}

export function computeSeries(
  bookings: StatsBooking[],
  from: string,
  to: string,
  timezone: string,
): { granularity: Granularity; points: SeriesPoint[] } {
  const granularity = pickGranularity(from, to)
  const points = new Map<string, SeriesPoint>()
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = bucketKey(d, granularity)
    if (!points.has(key)) points.set(key, { key, revenue: 0, completed: 0 })
  }
  for (const b of bookings) {
    if (b.status !== BookingStatus.COMPLETED) continue
    const point = points.get(bucketKey(toDateString(b.startAt, timezone), granularity))
    if (!point) continue
    point.revenue += b.paidAmount ?? 0
    point.completed += 1
  }
  return { granularity, points: [...points.values()] }
}

export function computeDistribution(bookings: StatsBooking[], timezone: string) {
  const byHour = Array.from({ length: 24 }, () => 0)
  const byWeekday = Array.from({ length: 7 }, () => 0)
  for (const b of bookings) {
    if (b.status !== BookingStatus.COMPLETED) continue
    const parts = zonedParts(b.startAt, timezone)
    byHour[parts.hour] += 1
    byWeekday[parts.weekday] += 1
  }
  return { byHour, byWeekday }
}

export function rankCustomers(bookings: StatsBooking[], limit = 3) {
  const map = new Map<string, { customerId: string; visits: number; spent: number }>()
  for (const b of bookings) {
    if (b.status !== BookingStatus.COMPLETED) continue
    const entry = map.get(b.customerId) ?? { customerId: b.customerId, visits: 0, spent: 0 }
    entry.visits += 1
    entry.spent += b.paidAmount ?? 0
    map.set(b.customerId, entry)
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || b.spent - a.spent).slice(0, limit)
}

export function rankServices(bookings: StatsBooking[]) {
  const map = new Map<string, { serviceId: string; name: string; count: number; revenue: number }>()
  for (const b of bookings) {
    if (b.status !== BookingStatus.COMPLETED) continue
    const entry = map.get(b.serviceId) ?? {
      serviceId: b.serviceId,
      name: b.serviceName,
      count: 0,
      revenue: 0,
    }
    entry.count += 1
    entry.revenue += b.paidAmount ?? 0
    map.set(b.serviceId, entry)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue)
}
