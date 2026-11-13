/**
 * محرّك الحجوزات الدورية — منطق نقي بلا قاعدة بيانات (docs/RECURRING_BOOKINGS_PLAN.md).
 *
 * السلسلة قالب: أول موعد (startDate + startTime) وتكرار كل N أسبوع وقائمة خدمات تتناوب.
 * المحرّك يحسب أي المواعيد تُنشأ وأيها يتعذّر ولماذا؛ الكتابة في القاعدة في مرحلة لاحقة.
 *
 * «اليوم» هنا هو يوم الدوام (shop day) كما في `shopWindow`: إن كان الدوام يمتد بعد منتصف
 * الليل (closeTime ≤ openTime) فوقت مثل 01:00 يتبع يوم الدوام الذي بدأ قبله، فيقع
 * فعلياً في صباح التاريخ التالي — مطابقاً لما تعرضه شبكة المواعيد.
 */
import {
  addMinutes,
  addDays,
  DAY_MINUTES,
  diffDays,
  parseTime,
  zonedToUtc,
} from '../../common/utils/time'
import { Interval, overlaps, shopWindow, ShopHours } from '../bookings/schedule'

export const MIN_INTERVAL_WEEKS = 1
export const MAX_INTERVAL_WEEKS = 4
export const MAX_ROTATION = 6

/** أسباب تعذّر إنشاء موعد متوقّع — تُعرض للمستخدم ولا تُفشل العملية */
export type IssueReason = 'CLOSED' | 'OUTSIDE_HOURS' | 'SERVICE_UNAVAILABLE' | 'CONFLICT'

export interface SeriesTemplate {
  /** YYYY-MM-DD — أول موعد؛ يحدّد يوم الأسبوع والطور */
  startDate: string
  /** HH:mm بتوقيت الصالون */
  startTime: string
  intervalWeeks: number
  /** آخر يوم شامل، أو null */
  endDate: string | null
  /** السلسلة موقوفة: لا يُولَّد شيء */
  stopped: boolean
  /** ترتيب التناوب (1–6 معرّفات، التكرار مسموح) */
  serviceIds: string[]
}

export interface PlanService {
  id: string
  name: string
  durationMinutes: number
  /** غير مؤرشفة وفعّالة */
  available: boolean
}

export interface Occurrence {
  date: string
  /** رقم الموعد منذ startDate (يبدأ من 0) */
  k: number
}

export interface PlannedOccurrence extends Occurrence {
  serviceId: string
  startAt: Date
  endAt: Date
}

export interface OccurrenceIssue extends Occurrence {
  reason: IssueReason
}

export interface Plan {
  create: PlannedOccurrence[]
  issues: OccurrenceIssue[]
}

function assertInterval(intervalWeeks: number): void {
  if (
    !Number.isInteger(intervalWeeks) ||
    intervalWeeks < MIN_INTERVAL_WEEKS ||
    intervalWeeks > MAX_INTERVAL_WEEKS
  ) {
    throw new Error(`intervalWeeks must be an integer ${MIN_INTERVAL_WEEKS}–${MAX_INTERVAL_WEEKS}`)
  }
}

function assertTemplate(series: Pick<SeriesTemplate, 'intervalWeeks' | 'serviceIds'>): void {
  assertInterval(series.intervalWeeks)
  if (series.serviceIds.length < 1 || series.serviceIds.length > MAX_ROTATION) {
    throw new Error(`serviceIds must hold 1–${MAX_ROTATION} entries`)
  }
}

/** خدمة الموعد رقم k: التناوب حتمي من الترتيب فقط (المؤجَّل/المُلغى يستهلك دوره) */
export function serviceIdAt(serviceIds: readonly string[], k: number): string {
  return serviceIds[((k % serviceIds.length) + serviceIds.length) % serviceIds.length]
}

/** رقم الموعد لتاريخ، أو null إن لم يقع على جدول السلسلة */
export function occurrenceIndex(
  series: Pick<SeriesTemplate, 'startDate' | 'intervalWeeks'>,
  date: string,
): number | null {
  const days = diffDays(series.startDate, date)
  const step = 7 * series.intervalWeeks
  return days >= 0 && days % step === 0 ? days / step : null
}

/** تواريخ المواعيد ضمن [from, to] (شاملان) مقصوصة بـ startDate و endDate — بغضّ النظر عن الإيقاف */
export function occurrenceDates(
  series: Pick<SeriesTemplate, 'startDate' | 'intervalWeeks' | 'endDate'>,
  from: string,
  to: string,
): Occurrence[] {
  assertInterval(series.intervalWeeks)
  const first = from > series.startDate ? from : series.startDate
  const last = series.endDate && series.endDate < to ? series.endDate : to
  if (first > last) return []

  const step = 7 * series.intervalWeeks
  const result: Occurrence[] = []
  for (let k = Math.ceil(diffDays(series.startDate, first) / step); ; k++) {
    const date = addDays(series.startDate, k * step)
    if (date > last) break
    result.push({ date, k })
  }
  return result
}

/** لحظة بداية الموعد (UTC) لتاريخ يوم دوام ووقت HH:mm بتوقيت الصالون */
export function occurrenceStart(date: string, startTime: string, hours: ShopHours): Date {
  const open = parseTime(hours.openTime)
  const wraps = parseTime(hours.closeTime) <= open
  let minutes = parseTime(startTime)
  // وقت قبل بداية الدوام في دوام يتخطّى منتصف الليل = ما بعد منتصف ليل يوم الدوام نفسه
  if (wraps && minutes < open) minutes += DAY_MINUTES
  return zonedToUtc(date, minutes, hours.timezone)
}

export interface PlanInput {
  series: SeriesTemplate
  services: readonly PlanService[]
  hours: ShopHours
  /** النطاق المطلوب توليده (تواريخ شاملة) */
  from: string
  to: string
  now: Date
  /** تواريخ لها حجز موجود أصلاً (أي حالة) — تُعتبر منجزة ولا تُعاد */
  existingDates: ReadonlySet<string>
  /** الحجوزات التي تحجز الوقت داخل النطاق */
  busy: readonly Interval[]
}

/**
 * يخطّط ما يُنشأ وما يتعذّر. لا يُنشأ أبداً موعد بدايته ≤ الآن (يُتجاهل بصمت)،
 * ولا يُزاح حجز قائم. ما يُخطَّط يُضاف إلى `busy` تدريجياً (نسخة محلية).
 */
export function planOccurrences(input: PlanInput): Plan {
  const { series, hours, now } = input
  assertTemplate(series)
  const plan: Plan = { create: [], issues: [] }
  if (series.stopped) return plan

  const byId = new Map(input.services.map((s) => [s.id, s]))
  const busy: Interval[] = [...input.busy]

  for (const { date, k } of occurrenceDates(series, input.from, input.to)) {
    if (input.existingDates.has(date)) continue
    const startAt = occurrenceStart(date, series.startTime, hours)
    if (startAt <= now) continue

    const window = shopWindow(date, hours)
    if (window.closed) {
      plan.issues.push({ date, k, reason: 'CLOSED' })
      continue
    }
    const serviceId = serviceIdAt(series.serviceIds, k)
    const service = byId.get(serviceId)
    if (!service?.available) {
      plan.issues.push({ date, k, reason: 'SERVICE_UNAVAILABLE' })
      continue
    }
    const endAt = addMinutes(startAt, service.durationMinutes)
    if (startAt < window.start || endAt > window.end) {
      plan.issues.push({ date, k, reason: 'OUTSIDE_HOURS' })
      continue
    }
    const range = { start: startAt, end: endAt }
    if (busy.some((b) => overlaps(range, b))) {
      plan.issues.push({ date, k, reason: 'CONFLICT' })
      continue
    }
    busy.push(range)
    plan.create.push({ date, k, serviceId, startAt, endAt })
  }
  return plan
}

// ───────────────────────── تعديل السلسلة وإيقافها (D9, D10) ─────────────────────────

export type ExistingStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

/** حجز موجود مرتبط بالسلسلة */
export interface ExistingOccurrence {
  id: string
  occurrenceDate: string
  startAt: Date
  endAt: Date
  status: ExistingStatus
  /** عُدّل يدوياً (recurringEdited) */
  edited: boolean
}

/** يُعاد كتابته عند تعديل السلسلة أو إيقافها: قادم، قيد العمل، غير معدّل يدوياً */
export function isRewritable(booking: ExistingOccurrence, now: Date): boolean {
  return booking.startAt > now && booking.status === 'ACTIVE' && !booking.edited
}

export interface SeriesChange {
  /** حجوزات تُحذف */
  remove: ExistingOccurrence[]
  /** مواعيد تُنشأ بعد الحذف */
  create: PlannedOccurrence[]
  issues: OccurrenceIssue[]
  /** مواعيد قادمة قيد العمل عُدّلت يدوياً فتبقى كما هي */
  keptEdited: number
}

export interface SeriesChangeInput extends Omit<PlanInput, 'existingDates' | 'busy'> {
  /** كل حجوزات السلسلة الموجودة (ما قبل الأفق مقبول؛ المهم تاريخها وحالتها) */
  existing: readonly ExistingOccurrence[]
  /** كل الحجوزات التي تحجز الوقت داخل النطاق، **بما فيها** حجوزات السلسلة نفسها */
  busy: readonly (Interval & { id?: string })[]
}

/**
 * ما يحدث عند تطبيق قالب جديد (series) على حجوزات السلسلة الحالية:
 * تُحذف المواعيد القابلة لإعادة الكتابة (مع تحرير أوقاتها من `busy`) ثم تُخطَّط الفراغات.
 * للإيقاف مرّر series بـ stopped = true: يُحذف القابل ولا يُنشأ شيء.
 * `busy` يجب أن يحمل `id` الحجز لتحرير ما سيُحذف؛ ما بلا id يبقى كما هو.
 */
export function planSeriesChange(input: SeriesChangeInput): SeriesChange {
  const { existing, now } = input
  const remove = existing.filter((b) => isRewritable(b, now))
  const removeIds = new Set(remove.map((b) => b.id))
  const keptDates = new Set(
    existing.filter((b) => !removeIds.has(b.id)).map((b) => b.occurrenceDate),
  )
  const busy = input.busy.filter((b) => !b.id || !removeIds.has(b.id))

  const plan = planOccurrences({ ...input, existingDates: keptDates, busy })
  return {
    remove,
    create: plan.create,
    issues: plan.issues,
    keptEdited: existing.filter((b) => b.startAt > now && b.status === 'ACTIVE' && b.edited).length,
  }
}

// ───────────────────────── الحذف النهائي (D8) ─────────────────────────

/**
 * هل يُمنع الحذف النهائي لهذا الحجز؟ موعد دوري ضمن نطاق التوليد وسلسلته ما زالت تولّد
 * سيُعاد إنشاؤه، فيُطلب إلغاؤه أو إيقاف السلسلة. `fromDate` = أول تاريخ يغطّيه المولّد (أمس).
 */
export function blocksHardDelete(
  booking: { recurringId: string | null; occurrenceDate: string | null },
  series: { stoppedAt: Date | null; endDate: string | null } | null,
  fromDate: string,
): boolean {
  if (!booking.recurringId || !booking.occurrenceDate || !series) return false
  if (series.stoppedAt) return false
  if (series.endDate && booking.occurrenceDate > series.endDate) return false
  return booking.occurrenceDate >= fromDate
}
