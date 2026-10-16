/** أنواع العقد مع الـ API (المرجع: Swagger على /api/docs) */

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface ApiErrorBody {
  statusCode: number
  message: string
  errors?: Record<string, string[]>
}

export interface RoleRef {
  id: number
  name: 'admin' | 'staff' | string
  label: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: RoleRef
  permissions: string[]
}

export interface User {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  role: RoleRef
}

export interface Role extends RoleRef {
  permissions: { key: string; description: string }[]
  usersCount: number
}

export interface ShopSettings {
  shopName: string
  openTime: string
  closeTime: string
  slotMinutes: number
  timezone: string
  daysOff: number[]
  today: string
}

export interface Service {
  id: string
  name: string
  price: number
  durationMinutes: number
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface CustomerRef {
  id: string
  name: string
  phone: string | null
}

export interface Customer extends CustomerRef {
  notes: string | null
  createdAt: string
  visits: number
  lastVisitAt: string | null
}

export type BookingStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface Booking {
  id: string
  customerId: string
  serviceId: string
  serviceName: string
  price: number
  durationMinutes: number
  startAt: string
  endAt: string
  status: BookingStatus
  paidAmount: number | null
  notes: string | null
  cancelReason: string | null
  completedAt: string | null
  cancelledAt: string | null
  createdAt: string
  customer: CustomerRef
  createdBy: { id: string; name: string } | null
}

export interface CustomerDetails extends CustomerRef {
  notes: string | null
  createdAt: string
  stats: {
    visits: number
    totalSpent: number
    lastVisitAt: string | null
    cancelled: number
    upcoming: number
  }
  bookings: Booking[]
}

export interface TimeRange {
  start: string
  end: string
}

export interface Gap extends TimeRange {
  minutes: number
  past: boolean
}

export interface DaySchedule {
  date: string
  timezone: string
  slotMinutes: number
  closed: boolean
  window: TimeRange
  now: string
  bookings: Booking[]
  gaps: Gap[]
  summary: {
    total: number
    active: number
    completed: number
    cancelled: number
    revenue: number
    expected: number
  }
}

export type SlotState = 'available' | 'booked' | 'conflict' | 'past'

export interface Slot extends TimeRange {
  state: SlotState
  bookingId?: string
}

export interface Availability {
  date: string
  timezone: string
  closed: boolean
  durationMinutes: number
  stepMinutes: number
  window: TimeRange
  slots: Slot[]
}

export interface StatsTotals {
  bookings: number
  completed: number
  active: number
  cancelled: number
  customers: number
  revenue: number
  workMinutes: number
  avgTicket: number
  cancellationRate: number
}

export interface StatsSummary {
  range: { from: string; to: string; days: number }
  previousRange: { from: string; to: string }
  totals: StatsTotals
  previous: StatsTotals
  series: {
    granularity: 'day' | 'week' | 'month'
    points: { key: string; revenue: number; completed: number }[]
  }
  byHour: number[]
  byWeekday: number[]
  topCustomers: {
    customerId: string
    visits: number
    spent: number
    customer: CustomerRef | null
  }[]
  topServices: { serviceId: string; name: string; count: number; revenue: number }[]
}
