import { Prisma } from '@prisma/client'

export const bookingInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>

/** الحالات التي تحجز الوقت — الملغي يحرّر مكانه */
export const BLOCKING_STATUSES = ['ACTIVE', 'COMPLETED'] as const
