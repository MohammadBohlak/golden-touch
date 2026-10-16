/**
 * أدوات التوقيت: كل الأوقات تُخزَّن UTC، ويُحسب "اليوم" و"ساعات الدوام" بتوقيت الصالون.
 * لا نعتمد على مكتبة تواريخ — Intl يكفي لحساب إزاحة أي منطقة زمنية (مع دعم التوقيت الصيفي).
 */

export const MINUTE_MS = 60_000
export const DAY_MINUTES = 1440

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    formatterCache.set(timeZone, formatter)
  }
  return formatter
}

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 = الأحد … 6 = السبت */
  weekday: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  }
}

/** إزاحة المنطقة الزمنية عن UTC بالدقائق في لحظة معيّنة (دمشق = +180) */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE_MS)
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/**
 * يحوّل "تاريخ + دقائق منذ منتصف الليل" بتوقيت الصالون إلى لحظة UTC.
 * الدقائق قد تتجاوز 1440 (دوام بعد منتصف الليل).
 */
export function zonedToUtc(dateStr: string, minutes: number, timeZone: string): Date {
  const match = DATE_PATTERN.exec(dateStr)
  if (!match) throw new Error(`Invalid date: ${dateStr}`)
  const [, y, m, d] = match.map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, minutes)
  let offset = tzOffsetMinutes(new Date(guess), timeZone)
  let result = guess - offset * MINUTE_MS
  // تصحيح مرة واحدة إن عبرنا حدّ تغيير التوقيت
  const corrected = tzOffsetMinutes(new Date(result), timeZone)
  if (corrected !== offset) {
    offset = corrected
    result = guess - offset * MINUTE_MS
  }
  return new Date(result)
}

/** YYYY-MM-DD لِلَحظة معيّنة بتوقيت الصالون */
export function toDateString(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** عدد الأيام بين تاريخين (to - from) */
export function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (DAY_MINUTES * MINUTE_MS),
  )
}

/** يوم الأسبوع لتاريخ (0 = الأحد) */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** "HH:mm" → دقائق منذ منتصف الليل */
export function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** بداية ونهاية يوم تقويمي كامل بتوقيت الصالون */
export function dayRangeUtc(dateStr: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedToUtc(dateStr, 0, timeZone),
    end: zonedToUtc(addDays(dateStr, 1), 0, timeZone),
  }
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS)
}

/** نص وقت مقروء بالعربية بتوقيت الصالون (للرسائل) */
export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}
