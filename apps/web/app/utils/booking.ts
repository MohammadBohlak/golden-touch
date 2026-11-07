import type { BookingStatus } from '~/types/api'
import type { IconName } from './icons'

export const STATUS_META: Record<
  BookingStatus,
  { label: string; tone: 'gold' | 'success' | 'danger'; icon: IconName; accent: string }
> = {
  ACTIVE: { label: 'قيد العمل', tone: 'gold', icon: 'clock', accent: 'border-s-gold-400' },
  COMPLETED: { label: 'مكتمل', tone: 'success', icon: 'check', accent: 'border-s-success' },
  CANCELLED: { label: 'ملغي', tone: 'danger', icon: 'ban', accent: 'border-s-red-300' },
}

/** شكل بطاقة الفراغ: مضى · متاح للحجز · قصير/غير قابل للحجز. مصدر واحد للمفتاح والعرض. */
export type GapVariant = 'past' | 'open' | 'short'

export function gapVariant(
  gap: { past: boolean; minutes: number },
  minDuration: number,
  canCreate: boolean,
): GapVariant {
  if (gap.past) return 'past'
  return canCreate && gap.minutes >= minDuration ? 'open' : 'short'
}

export const STATUS_FILTERS: { value: BookingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'الكل' },
  { value: 'ACTIVE', label: 'قيد العمل' },
  { value: 'COMPLETED', label: 'مكتمل' },
  { value: 'CANCELLED', label: 'ملغي' },
]

export const CANCEL_REASONS = ['اعتذر الزبون', 'لم يحضر الزبون', 'تغيير الموعد', 'ظرف طارئ']

export const PHONE_PATTERN = /^\+?[\d\s\-()٠-٩]{6,20}$/
