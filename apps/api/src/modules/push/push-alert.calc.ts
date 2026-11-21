/**
 * منطق نقي (بلا قاعدة بيانات ولا شبكة) لإشعار «موعد بعد N دقيقة» للطاقم — docs/PUSH_NOTIFICATIONS_PLAN.md §5.2.
 */
import { formatTime } from '../../common/utils/time'

const MINUTE_MS = 60_000

/** أقل مهلة لإرسال الإشعار: أقرب من هذا لا فائدة منه (الموعد يبدأ فعلاً) */
export const MIN_LEAD_MINUTES = 1
/** عمر الاشتراك دون فتح التطبيق = عمر الجلسة (JWT_EXPIRES_IN الافتراضي 30 يوماً) */
export const SUBSCRIPTION_MAX_IDLE_DAYS = 30
/** أدنى TTL (ثوانٍ) لرسالة Push: Apple تشترطه موجباً */
export const MIN_TTL_SECONDS = 60

/** نافذة الاستحقاق: الموعد يبدأ بعد أكثر من دقيقة وبحد أقصى `alertMinutes` */
export function alertWindow(now: Date, alertMinutes: number): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() + MIN_LEAD_MINUTES * MINUTE_MS),
    to: new Date(now.getTime() + alertMinutes * MINUTE_MS),
  }
}

/**
 * قرار D2: حجز أُنشئ داخل نافذة الإنذار (أقل من `alertMinutes` قبل بدايته) لا يُشعَر به —
 * الزبون حاضر أو الحجز للتو وصاحبه يعرفه.
 */
export function createdInsideWindow(
  booking: { startAt: Date; createdAt: Date },
  alertMinutes: number,
): boolean {
  return booking.createdAt.getTime() > booking.startAt.getTime() - alertMinutes * MINUTE_MS
}

/** الدقائق المتبقية بالتقريب (≥ 1) — تُعرَض في العنوان، فتدارك التأخير يُظهر الرقم الفعلي */
export function minutesUntil(startAt: Date, now: Date): number {
  return Math.max(1, Math.round((startAt.getTime() - now.getTime()) / MINUTE_MS))
}

/** TTL = الثواني حتى بداية الموعد (إشعار فات موعده لا قيمة له)، بحد أدنى تشترطه Apple */
export function ttlSeconds(startAt: Date, now: Date): number {
  return Math.max(MIN_TTL_SECONDS, Math.floor((startAt.getTime() - now.getTime()) / 1000))
}

/** «موعد بعد 15 دقيقة» — بصيغة العدد العربية الصحيحة */
export function alertTitle(minutes: number): string {
  if (minutes === 1) return 'موعد بعد دقيقة'
  if (minutes === 2) return 'موعد بعد دقيقتين'
  if (minutes <= 10) return `موعد بعد ${minutes} دقائق`
  return `موعد بعد ${minutes} دقيقة`
}

export interface AlertBooking {
  id: string
  customerName: string
  serviceName: string
  startAt: Date
}

export interface AlertPayload {
  title: string
  body: string
  /** يمنع تكرار إشعار الحجز نفسه ويستبدل السابق */
  tag: string
}

/**
 * محتوى الإشعار: «الاسم · الخدمة · 4:30 م» فقط.
 * ممنوع هنا السعر والهاتف وأي حقل مالي أو تاريخي (قرار صاحب المشروع — يصل للمشرف أيضاً).
 */
export function buildAlertPayload(
  booking: AlertBooking,
  now: Date,
  timezone: string,
): AlertPayload {
  return {
    title: alertTitle(minutesUntil(booking.startAt, now)),
    body: `${booking.customerName} · ${booking.serviceName} · ${formatTime(booking.startAt, timezone)}`,
    tag: `booking-${booking.id}`,
  }
}
