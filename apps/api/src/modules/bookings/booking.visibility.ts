/**
 * رؤية الحجوزات حسب صلاحيات المستخدم — منطق نقي بلا قاعدة بيانات.
 * يطبّق قرارات docs/STAFF_RESTRICTIONS_PLAN.md:
 *  - المال (price / paidAmount / revenue / expected) لا يُرسَل أصلاً لمن لا يملك finance.read.
 *  - الماضي (قبل بداية اليوم بتوقيت الصالون) لا يراه من لا يملك bookings.history.
 *  - احتساب مبلغ التأكيد تلقائياً من سعر الحجز (D11).
 */
import { ForbiddenException } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import type { AuthUser } from '../../common/types/auth-user'
import { dayRangeUtc, toDateString } from '../../common/utils/time'
import type { BookingWithRelations } from './booking.mapper'

export interface BookingCaps {
  /** يرى ويحدّد الأسعار والمبالغ */
  finance: boolean
  /** يرى الحجوزات السابقة */
  history: boolean
}

export const MSG_NO_FINANCE = 'ليس لديك صلاحية لتحديد الأسعار والمبالغ'
export const MSG_NO_HISTORY = 'ليس لديك صلاحية لعرض الحجوزات السابقة'
export const MSG_NO_PAST_WRITE = 'لا يمكنك إنشاء أو نقل حجز إلى تاريخ سابق'
export const MSG_REOPEN_ADJUSTED = 'لا يمكن إعادة فتح هذا الحجز، راجع المدير'

export function capsOf(user: Pick<AuthUser, 'permissions'>): BookingCaps {
  const granted = new Set(user.permissions)
  return { finance: granted.has('finance.read'), history: granted.has('bookings.history') }
}

/** بداية اليوم الحالي بتوقيت الصالون: كل ما يبدأ قبلها «سابق» (D1) */
export function historyCutoff(now: Date, timezone: string): Date {
  return dayRangeUtc(toDateString(now, timezone), timezone).start
}

// ───────────────────────── إخفاء المال ─────────────────────────

/** الحجز كما يُرسَل للعميل: الحقلان الماليان غائبان تماماً عمّن لا يملك finance.read */
export type BookingView = Omit<BookingWithRelations, 'price' | 'paidAmount'> & {
  price?: number
  paidAmount?: number | null
}

export function toBookingView(booking: BookingWithRelations, caps: BookingCaps): BookingView {
  if (caps.finance) return booking
  const { price: _price, paidAmount: _paidAmount, ...rest } = booking
  return rest
}

export interface DaySummary {
  total: number
  active: number
  completed: number
  cancelled: number
  revenue?: number
  expected?: number
}

type SummaryInput = Pick<BookingWithRelations, 'status' | 'price' | 'paidAmount'>

export function buildDaySummary(bookings: SummaryInput[], caps: BookingCaps): DaySummary {
  const completed = bookings.filter((b) => b.status === BookingStatus.COMPLETED)
  const active = bookings.filter((b) => b.status === BookingStatus.ACTIVE)
  const cancelled = bookings.filter((b) => b.status === BookingStatus.CANCELLED)
  const summary: DaySummary = {
    total: bookings.length - cancelled.length,
    active: active.length,
    completed: completed.length,
    cancelled: cancelled.length,
  }
  if (caps.finance) {
    summary.revenue = completed.reduce((sum, b) => sum + (b.paidAmount ?? 0), 0)
    summary.expected = active.reduce((sum, b) => sum + b.price, 0)
  }
  return summary
}

// ───────────────────────── تأكيد الحجز (D11) ─────────────────────────

export interface CompletionInput {
  /** سعر الحجز المحفوظ: سعر الخدمة وقت الحجز أو ما حدّده المدير */
  bookingPrice: number
  /** سعر الخدمة الحالي (قد تُؤرشف الخدمة فيغيب) */
  servicePrice: number | null
  /** المبلغ الذي أرسله العميل صراحةً */
  requested: number | undefined
}

/**
 * المبلغ المدفوع وسعر الحجز عند الإكمال:
 *  - مبلغ صريح: للمدير فقط (المشرف يُرفض)، ولا يغيّر سعر الحجز.
 *  - بلا مبلغ: يُسجَّل سعر الحجز؛ فإن كان 0 («غير محدد») استُعمل سعر الخدمة الحالي إن كان > 0 وحُفظ على الحجز.
 */
export function resolveCompletion(
  input: CompletionInput,
  caps: BookingCaps,
): { paidAmount: number; price: number } {
  if (input.requested !== undefined) {
    if (!caps.finance) throw new ForbiddenException(MSG_NO_FINANCE)
    return { paidAmount: input.requested, price: input.bookingPrice }
  }
  const price =
    input.bookingPrice === 0 && (input.servicePrice ?? 0) > 0
      ? (input.servicePrice as number)
      : input.bookingPrice
  return { paidAmount: price, price }
}

/**
 * إعادة فتح حجز مكتمل تمسح المبلغ المدفوع. من لا يملك finance.read لا يعيد فتح
 * حجز عدّل المدير مبلغه (≠ سعر الحجز) كي لا يضيع تصحيح المدير.
 */
export function assertCanReopen(
  booking: Pick<BookingWithRelations, 'status' | 'price' | 'paidAmount'>,
  caps: BookingCaps,
): void {
  if (caps.finance) return
  if (
    booking.status === BookingStatus.COMPLETED &&
    booking.paidAmount !== null &&
    booking.paidAmount !== booking.price
  ) {
    throw new ForbiddenException(MSG_REOPEN_ADJUSTED)
  }
}
