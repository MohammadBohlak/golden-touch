/**
 * شكل الحجز الدوري كما يُرسَل للعميل. الحقول مختارة صراحةً (لا spread) كي لا يتسرّب إليه
 * أي حقل مالي مستقبلاً: القالب لا يحمل مالاً أصلاً (docs/RECURRING_BOOKINGS_PLAN.md D11).
 */
import { Prisma } from '@prisma/client'
import { weekdayOf } from '../../common/utils/time'
import type { OccurrenceIssue } from './recurrence'
import { dateOnly } from './recurring.mapper'

export const seriesInclude = {
  services: { orderBy: { position: 'asc' } },
  customer: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.RecurringBookingInclude

export type SeriesRow = Prisma.RecurringBookingGetPayload<{ include: typeof seriesInclude }>

/** ACTIVE: تُولَّد مواعيدها · ENDED: بلغت تاريخ نهايتها · STOPPED: أوقفها المستخدم */
export type SeriesStatus = 'ACTIVE' | 'ENDED' | 'STOPPED'

export interface NextOccurrence {
  date: string
  startAt: Date
  serviceName: string
}

export interface SeriesView {
  id: string
  customer: { id: string; name: string; phone: string | null }
  /** 0 = الأحد … 6 = السبت */
  weekday: number
  startDate: string
  startTime: string
  intervalWeeks: number
  endDate: string | null
  notes: string | null
  status: SeriesStatus
  stoppedAt: Date | null
  createdAt: Date
  /** بالترتيب؛ التكرار مسموح (التناوب) */
  services: { id: string; name: string; durationMinutes: number }[]
  next: NextOccurrence | null
  issues: OccurrenceIssue[]
}

export function seriesStatus(
  series: Pick<SeriesRow, 'stoppedAt' | 'endDate'>,
  today: string,
): SeriesStatus {
  if (series.stoppedAt) return 'STOPPED'
  if (series.endDate && dateOnly(series.endDate) < today) return 'ENDED'
  return 'ACTIVE'
}

export function toSeriesView(
  series: SeriesRow,
  extra: {
    today: string
    services: ReadonlyMap<string, { name: string; durationMinutes: number }>
    next: NextOccurrence | null
    issues: OccurrenceIssue[]
  },
): SeriesView {
  const startDate = dateOnly(series.startDate)
  return {
    id: series.id,
    customer: {
      id: series.customer.id,
      name: series.customer.name,
      phone: series.customer.phone,
    },
    weekday: weekdayOf(startDate),
    startDate,
    startTime: series.startTime,
    intervalWeeks: series.intervalWeeks,
    endDate: series.endDate ? dateOnly(series.endDate) : null,
    notes: series.notes,
    status: seriesStatus(series, extra.today),
    stoppedAt: series.stoppedAt,
    createdAt: series.createdAt,
    services: [...series.services]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.serviceId,
        name: extra.services.get(s.serviceId)?.name ?? '—',
        durationMinutes: extra.services.get(s.serviceId)?.durationMinutes ?? 0,
      })),
    next: extra.next,
    issues: extra.issues,
  }
}
