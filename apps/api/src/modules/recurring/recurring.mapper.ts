/**
 * تحويلات نقية بين صفوف Prisma وأنواع المحرّك (recurrence.ts).
 * أعمدة DATE تعود من Prisma كـ Date عند منتصف الليل UTC، وتُكتب كذلك.
 */
import type { Prisma } from '@prisma/client'
import type { SeriesTemplate } from './recurrence'

export type SeriesWithServices = Prisma.RecurringBookingGetPayload<{
  include: { services: true }
}>

/** YYYY-MM-DD لعمود DATE */
export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** عمود DATE من YYYY-MM-DD */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function toTemplate(series: SeriesWithServices): SeriesTemplate {
  return {
    startDate: dateOnly(series.startDate),
    startTime: series.startTime,
    intervalWeeks: series.intervalWeeks,
    endDate: series.endDate ? dateOnly(series.endDate) : null,
    stopped: series.stoppedAt !== null,
    serviceIds: [...series.services]
      .sort((a, b) => a.position - b.position)
      .map((s) => s.serviceId),
  }
}
