/**
 * منطق الجدولة كدوال نقية (بلا قاعدة بيانات) لسهولة الاختبار:
 * نافذة الدوام، الفترات المتاحة لخدمة بمدة معيّنة، والفراغات بين الحجوزات.
 */
import { DAY_MINUTES, MINUTE_MS, parseTime, weekdayOf, zonedToUtc } from '../../common/utils/time'

export interface Interval {
  start: Date
  end: Date
}

export interface BusyInterval extends Interval {
  id: string
}

export interface ShopHours {
  openTime: string
  closeTime: string
  daysOff: number[]
  timezone: string
}

export interface ShopWindow extends Interval {
  /** يوم عطلة أسبوعية */
  closed: boolean
}

/** available: متاح | booked: داخل حجز | conflict: البداية فارغة لكن المدة تتداخل/تتجاوز الدوام | past: مضى */
export type SlotState = 'available' | 'booked' | 'conflict' | 'past'

export interface Slot extends Interval {
  state: SlotState
  bookingId?: string
}

export interface Gap extends Interval {
  minutes: number
  past: boolean
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

/** نافذة الدوام ليوم معيّن؛ إن كانت النهاية ≤ البداية فهي تمتد بعد منتصف الليل */
export function shopWindow(date: string, hours: ShopHours): ShopWindow {
  const open = parseTime(hours.openTime)
  let close = parseTime(hours.closeTime)
  if (close <= open) close += DAY_MINUTES
  return {
    start: zonedToUtc(date, open, hours.timezone),
    end: zonedToUtc(date, close, hours.timezone),
    closed: hours.daysOff.includes(weekdayOf(date)),
  }
}

export function computeSlots(params: {
  window: Interval
  busy: BusyInterval[]
  durationMinutes: number
  stepMinutes: number
  now: Date
}): Slot[] {
  const { window, busy, durationMinutes, stepMinutes, now } = params
  const stepMs = stepMinutes * MINUTE_MS
  const durationMs = durationMinutes * MINUTE_MS
  const slots: Slot[] = []

  for (let t = window.start.getTime(); t < window.end.getTime(); t += stepMs) {
    const slot: Interval = { start: new Date(t), end: new Date(t + durationMs) }
    const containing = busy.find((b) => b.start.getTime() <= t && t < b.end.getTime())
    let state: SlotState
    // الفترة الحالية تبقى متاحة حتى تنقضي خطوتها (لتسجيل زبون حاضر الآن)
    if (t + stepMs <= now.getTime()) state = 'past'
    else if (containing) state = 'booked'
    else if (slot.end > window.end || busy.some((b) => overlaps(slot, b))) state = 'conflict'
    else state = 'available'
    slots.push({ ...slot, state, ...(containing ? { bookingId: containing.id } : {}) })
  }
  return slots
}

function ceilTo(date: Date, minutes: number): Date {
  const ms = minutes * MINUTE_MS
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

function pushGap(list: Gap[], start: Date, end: Date, past: boolean) {
  const minutes = Math.round((end.getTime() - start.getTime()) / MINUTE_MS)
  if (minutes > 0) list.push({ start, end, minutes, past })
}

/** الفراغات الحرة داخل نافذة الدوام، مع فصل ما مضى منها عن القادم */
export function computeGaps(params: { window: Interval; busy: Interval[]; now: Date }): Gap[] {
  const { window, now } = params
  const busy = [...params.busy].sort((a, b) => a.start.getTime() - b.start.getTime())
  const free: Interval[] = []
  let cursor = window.start

  for (const b of busy) {
    if (b.end <= cursor) continue
    if (b.start >= window.end) break
    if (b.start > cursor) free.push({ start: cursor, end: b.start })
    cursor = b.end > cursor ? b.end : cursor
    if (cursor >= window.end) break
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end })

  const gaps: Gap[] = []
  for (const gap of free) {
    if (gap.end <= now) {
      pushGap(gaps, gap.start, gap.end, true)
    } else if (gap.start < now) {
      pushGap(gaps, gap.start, now, true)
      const next = ceilTo(now, 5)
      if (next < gap.end) pushGap(gaps, next, gap.end, false)
    } else {
      pushGap(gaps, gap.start, gap.end, false)
    }
  }
  return gaps
}
