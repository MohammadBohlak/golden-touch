/**
 * التحقق من قالب السلسلة — منطق نقي. الأخطاء بصيغة { الحقل: [رسائل] } كبقية الـ API.
 */
import { addDays } from '../../common/utils/time'
import type { IssueReason, OccurrenceIssue, PlannedOccurrence, SeriesTemplate } from './recurrence'

export type FieldErrors = Record<string, string[]>

/** أبعد بداية مسموحة (D13) */
export const MAX_START_AHEAD_DAYS = 365

export const MSG_STOPPED = 'الحجز الدوري موقوف'

/** سبب تعذّر الموعد ← الحقل الذي يصلحه المستخدم ورسالته */
export const ISSUE_FIELD: Record<IssueReason, { field: string; message: string }> = {
  CLOSED: { field: 'startDate', message: 'هذا اليوم عطلة أسبوعية في الصالون' },
  OUTSIDE_HOURS: { field: 'startTime', message: 'الوقت خارج ساعات الدوام' },
  SERVICE_UNAVAILABLE: { field: 'serviceIds', message: 'الخدمة غير متاحة (معطّلة أو مؤرشفة)' },
  CONFLICT: { field: 'startTime', message: 'هذا الوقت يتداخل مع حجز آخر' },
}

export function validateTemplate(input: {
  template: SeriesTemplate
  /** الخدمات الموجودة غير المؤرشفة والفعّالة */
  availableServiceIds: ReadonlySet<string>
  today: string
  /** يُتحقق من نطاق تاريخ البداية (عند الإنشاء أو تغييره) */
  checkStartRange: boolean
}): FieldErrors {
  const { template, availableServiceIds, today } = input
  const errors: FieldErrors = {}
  const add = (field: string, message: string) => (errors[field] ??= []).push(message)

  if (
    input.checkStartRange &&
    (template.startDate < today || template.startDate > addDays(today, MAX_START_AHEAD_DAYS))
  ) {
    add('startDate', 'تاريخ البداية يجب أن يكون من اليوم وحتى سنة قادمة')
  }
  if (template.endDate && template.endDate < template.startDate) {
    add('endDate', 'تاريخ الانتهاء قبل تاريخ البداية')
  }
  if (template.serviceIds.some((id) => !availableServiceIds.has(id))) {
    add('serviceIds', 'إحدى الخدمات غير موجودة أو غير متاحة')
  }
  return errors
}

export interface FirstOccurrenceProblem {
  status: 400 | 409
  field: string
  message: string
}

/**
 * الموعد الأول يجب أن يتحقق فعلاً عند إنشاء سلسلة (وإلا وُلدت سلسلة بلا موعد دون أن يفهم المستخدم السبب).
 * إن وقع خارج أفق التوليد فلا يمكن الحكم الآن (null) وتظهر مشكلته لاحقاً في المزامنة.
 */
export function firstOccurrenceProblem(
  startDate: string,
  horizonEnd: string,
  change: { create: PlannedOccurrence[]; issues: OccurrenceIssue[] },
): FirstOccurrenceProblem | null {
  if (startDate > horizonEnd) return null
  if (change.create.some((o) => o.date === startDate)) return null
  const issue = change.issues.find((i) => i.date === startDate)
  if (issue) {
    const { field, message } = ISSUE_FIELD[issue.reason]
    return { status: issue.reason === 'CONFLICT' ? 409 : 400, field, message }
  }
  return { status: 400, field: 'startTime', message: 'الموعد الأول مضى، اختر وقتاً قادماً' }
}
