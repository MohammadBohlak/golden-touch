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
  /** غائب عمّن لا يملك finance.read */
  price?: number
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
  /** غائبان عمّن لا يملك bookings.history */
  visits?: number
  lastVisitAt?: string | null
}

export type BookingStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface Booking {
  id: string
  customerId: string
  serviceId: string
  serviceName: string
  /** غائب عمّن لا يملك finance.read */
  price?: number
  durationMinutes: number
  startAt: string
  endAt: string
  status: BookingStatus
  /** غائب عمّن لا يملك finance.read */
  paidAmount?: number | null
  notes: string | null
  cancelReason: string | null
  completedAt: string | null
  cancelledAt: string | null
  createdAt: string
  /** الحجز الدوري الذي ولّد هذا الموعد (null = حجز عادي) */
  recurringId: string | null
  /** عُدّل يدوياً فلا تعيد كتابته تعديلات السلسلة */
  recurringEdited: boolean
  customer: CustomerRef
  createdBy: { id: string; name: string } | null
}

export interface CustomerDetails extends CustomerRef {
  notes: string | null
  createdAt: string
  stats: {
    upcoming: number
    /** bookings.history */
    visits?: number
    lastVisitAt?: string | null
    cancelled?: number
    /** finance.read */
    totalSpent?: number
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
    /** finance.read */
    revenue?: number
    expected?: number
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

// ───────────────────────── الحجوزات الدورية ─────────────────────────
// مرجعها Swagger: /api/docs → recurring-bookings. القالب بلا أي حقل مالي.

/** سبب تعذّر إنشاء موعد متوقّع */
export type RecurringIssueReason = 'CLOSED' | 'OUTSIDE_HOURS' | 'SERVICE_UNAVAILABLE' | 'CONFLICT'

export interface RecurringIssue {
  /** يوم الدوام YYYY-MM-DD */
  date: string
  /** رقم الموعد منذ البداية (يبدأ من 0) */
  k: number
  reason: RecurringIssueReason
}

/** ACTIVE: تُولَّد مواعيدها · ENDED: بلغت تاريخ نهايتها · STOPPED: أوقفها المستخدم */
export type RecurringStatus = 'ACTIVE' | 'ENDED' | 'STOPPED'

export interface RecurringSeries {
  id: string
  customer: CustomerRef
  /** 0 = الأحد … 6 = السبت */
  weekday: number
  startDate: string
  /** HH:mm بتوقيت الصالون */
  startTime: string
  intervalWeeks: number
  endDate: string | null
  notes: string | null
  status: RecurringStatus
  stoppedAt: string | null
  createdAt: string
  /** بالترتيب؛ التكرار مسموح (التناوب) */
  services: { id: string; name: string; durationMinutes: number }[]
  next: { date: string; startAt: string; serviceName: string } | null
  issues: RecurringIssue[]
}

/** تفاصيل سلسلة: المواعيد القادمة حجوزات عادية (المال فيها لمن يملك finance.read فقط) */
export interface RecurringDetails extends RecurringSeries {
  upcoming: Booking[]
}

/** استجابة الإنشاء والتعديل والإيقاف */
export interface RecurringMutation {
  series: RecurringDetails
  created: number
  removed: number
  keptEdited: number
}

export interface RecurringPreview {
  occurrences: {
    date: string
    startAt: string
    endAt: string
    serviceId: string
    serviceName: string
  }[]
  issues: RecurringIssue[]
  /** مواعيد قائمة ستُحذف (عند التعديل) */
  removeCount: number
  /** مواعيد قادمة عُدّلت يدوياً وستبقى */
  keptEdited: number
}
