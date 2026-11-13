/**
 * عرض الحجوزات الدورية بالعربية — ملف نقي يُختبر عبر node --test.
 * (الجمع العربي: موعد · موعدان · 3–10 مواعيد · 11+ موعداً)
 */
import type {
  Booking,
  RecurringIssue,
  RecurringIssueReason,
  RecurringSeries,
  RecurringStatus,
} from '../types/api.ts'
import {
  addDays,
  dateInTz,
  formatDateLong,
  formatTime,
  relativeDayLabel,
  timeInTz,
  weekdayOf,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
} from './datetime.ts'

/** وصف التكرار: «كل سبت» · «كل أسبوعين يوم السبت» · «كل 3 أسابيع يوم السبت» */
export function describeRecurrence(weekday: number, intervalWeeks: number): string {
  if (intervalWeeks <= 1) return `كل ${WEEKDAY_SHORT[weekday]}`
  const every = intervalWeeks === 2 ? 'كل أسبوعين' : `كل ${intervalWeeks} أسابيع`
  return `${every} يوم ${WEEKDAY_NAMES[weekday]}`
}

/** «5:00 م» من HH:mm (الوقت محلي بتوقيت الصالون، فلا تحويل منطقة) */
export function formatClockTime(hhmm: string): string {
  return formatTime(new Date(`1970-01-01T${hhmm}:00Z`), 'UTC')
}

/** سطر الخدمات: خدمة واحدة باسمها، وأكثر «تتناوب: أ ← ب» بالترتيب (← تتجه للتالي في الاتجاه العربي) */
export function describeServices(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '—'
  return `تتناوب: ${names.join(' ← ')}`
}

export const ISSUE_LABELS: Record<RecurringIssueReason, string> = {
  CLOSED: 'يوم عطلة',
  OUTSIDE_HOURS: 'خارج ساعات الدوام',
  SERVICE_UNAVAILABLE: 'الخدمة غير متاحة',
  CONFLICT: 'يتعارض مع حجز آخر',
}

/** «موعد» بحسب العدد: 1 موعد · 2 موعدان · 3–10 مواعيد · 11+ موعداً */
export function countAppointments(count: number): string {
  if (count === 1) return 'موعد واحد'
  if (count === 2) return 'موعدان'
  return count <= 10 ? `${count} مواعيد` : `${count} موعداً`
}

/** عنوان صندوق المشكلات: «تعذّر إنشاء موعدين» */
export function issuesTitle(count: number): string {
  if (count === 2) return 'تعذّر إنشاء موعدين'
  return `تعذّر إنشاء ${countAppointments(count)}`
}

/** «السبت، 31 تشرين الأول — يتعارض مع حجز آخر» */
export function issueLine(issue: Pick<RecurringIssue, 'date' | 'reason'>): string {
  return `${formatDateLong(issue.date)} — ${ISSUE_LABELS[issue.reason]}`
}

export const STATUS_LABELS: Record<RecurringStatus, string> = {
  ACTIVE: 'فعّال',
  ENDED: 'منتهٍ',
  STOPPED: 'موقوف',
}

/** «غداً · 5:00 م» أو «السبت 31 تشرين الأول · 5:00 م» */
export function nextLabel(
  next: { date: string; startAt: string },
  today: string,
  timeZone: string,
) {
  return `${relativeDayLabel(next.date, today)} · ${formatTime(next.startAt, timeZone)}`
}

// ───────────────────────── نموذج الإنشاء والتعديل ─────────────────────────

/** أقصى عدد خدمات في التناوب (يطابق الـ API) */
export const MAX_ROTATION = 6

export const INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'كل أسبوع' },
  { value: 2, label: 'كل أسبوعين' },
  { value: 3, label: 'كل 3 أسابيع' },
  { value: 4, label: 'كل 4 أسابيع' },
]

/** أول تاريخ ≥ from يقع في يوم الأسبوع المطلوب (0 = الأحد) */
export function nextWeekdayDate(from: string, weekday: number): string {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7)
}

/** نسخة من القائمة بعنصر منقول خطوة؛ خارج الحدود لا يتغيّر شيء */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  const next = [...list]
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return next
  ;[next[index], next[target]] = [next[target] as T, next[index] as T]
  return next
}

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس']

/** «الأول: شعر · الثاني: لحية · ثم يتكرر» — null لخدمة واحدة */
export function rotationCaption(names: readonly string[]): string | null {
  if (names.length < 2) return null
  return `${names.map((name, i) => `${ORDINALS[i]}: ${name}`).join(' · ')} · ثم يتكرر`
}

export interface RecurringFormValues {
  startDate: string
  /** HH:mm */
  startTime: string
  intervalWeeks: number
  /** صفوف التناوب بالترتيب؛ الفارغ = لم تُختر بعد */
  serviceIds: string[]
  endDate: string | null
  notes: string
}

/** يكفي للمعاينة: تاريخ ووقت صالحان وكل صفوف الخدمات مختارة */
export function canPreview(
  v: Pick<RecurringFormValues, 'startDate' | 'startTime' | 'serviceIds'>,
): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v.startDate) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(v.startTime) &&
    v.serviceIds.length > 0 &&
    v.serviceIds.every(Boolean)
  )
}

type Original = Pick<
  RecurringSeries,
  'id' | 'customer' | 'startDate' | 'startTime' | 'intervalWeeks' | 'endDate' | 'notes' | 'services'
>

/** الحقول التي تغيّرت عن السلسلة الحالية فقط (إرسال startDate دون تغيير يُخضعه لفحص «من اليوم» فيرفض سلسلة بدأت سابقاً) */
function changedFields(original: Original, v: RecurringFormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (v.startDate !== original.startDate) out.startDate = v.startDate
  if (v.startTime !== original.startTime) out.startTime = v.startTime
  if (v.intervalWeeks !== original.intervalWeeks) out.intervalWeeks = v.intervalWeeks
  const originalIds = original.services.map((s) => s.id)
  if (
    v.serviceIds.length !== originalIds.length ||
    v.serviceIds.some((id, i) => id !== originalIds[i])
  ) {
    out.serviceIds = v.serviceIds
  }
  if ((v.endDate || null) !== original.endDate) out.endDate = v.endDate || null
  return out
}

/** جسم POST /recurring-bookings */
export function createBody(v: RecurringFormValues, customerId: string): Record<string, unknown> {
  return {
    customerId,
    startDate: v.startDate,
    startTime: v.startTime,
    intervalWeeks: v.intervalWeeks,
    serviceIds: v.serviceIds,
    endDate: v.endDate || undefined,
    notes: v.notes.trim() || undefined,
  }
}

/** جسم PATCH /recurring-bookings/:id — المتغيّر فقط؛ endDate: null يمسح التاريخ، و notes: '' تمسح الملاحظات */
export function patchBody(
  original: Original,
  v: RecurringFormValues,
  customerId: string,
): Record<string, unknown> {
  const body = changedFields(original, v)
  if (customerId !== original.customer.id) body.customerId = customerId
  if (v.notes.trim() !== (original.notes ?? '')) body.notes = v.notes.trim()
  return body
}

/** جسم POST /recurring-bookings/preview: كامل للجديدة، وللتعديل المتغيّر فقط مع seriesId */
export function previewBody(v: RecurringFormValues, original?: Original): Record<string, unknown> {
  if (original) return { seriesId: original.id, ...changedFields(original, v) }
  return {
    startDate: v.startDate,
    startTime: v.startTime,
    intervalWeeks: v.intervalWeeks,
    serviceIds: v.serviceIds,
    endDate: v.endDate || null,
  }
}

// ───────────────────────── التكامل مع الحجوزات القائمة ─────────────────────────

/** موعد من حجز دوري لم ينتهِ بعد: لا يُحذف نهائياً (الخادم يرفض D8) — يُلغى أو يُوقف الحجز الدوري */
export function isUpcomingRecurring(
  booking: Pick<Booking, 'recurringId' | 'endAt'>,
  now: Date,
): boolean {
  return booking.recurringId !== null && new Date(booking.endAt).getTime() > now.getTime()
}

/**
 * «اجعله دورياً»: معاملات صفحة الحجز الدوري الجديد من حجز قائم. أول موعد دوري بعد الحجز بأسبوع
 * (الحجز نفسه موجود فلا يُكرَّر)، ويعدّل المستخدم يوم الأسبوع والتكرار من النموذج.
 */
export function recurringQueryFrom(
  booking: Pick<Booking, 'customer' | 'serviceId' | 'startAt'>,
  timeZone: string,
): Record<string, string> {
  return {
    customerId: booking.customer.id,
    serviceId: booking.serviceId,
    date: addDays(dateInTz(booking.startAt, timeZone), 7),
    time: timeInTz(booking.startAt, timeZone),
  }
}

export interface RecurringPrefill {
  date?: string
  time?: string
  serviceId?: string
}

/** يقرأ معاملات الرابط بتحقّق الصيغة (قيمة مشوّهة تُتجاهل فيبقى الافتراضي) */
export function parseRecurringPrefill(query: Record<string, unknown>): RecurringPrefill {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const date = str(query.date)
  const time = str(query.time)
  const serviceId = str(query.serviceId)
  return {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    time: time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : undefined,
    serviceId: serviceId || undefined,
  }
}
