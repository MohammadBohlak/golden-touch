/**
 * أدوات التاريخ والوقت بتوقيت الصالون (لا تعتمد على توقيت جهاز المستخدم).
 * ملف نقي بلا استيرادات — يُختبر مباشرة عبر node --test.
 */

export const LOCALE = 'ar-SY-u-nu-latn'
export const DEFAULT_TZ = 'Asia/Damascus'
const MINUTE_MS = 60_000

export const WEEKDAY_NAMES = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
]
export const WEEKDAY_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

const cache = new Map<string, Intl.DateTimeFormat>()
function fmt(timeZone: string, options: Intl.DateTimeFormatOptions, locale = LOCALE) {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`
  let formatter = cache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { timeZone, ...options })
    cache.set(key, formatter)
  }
  return formatter
}

/** YYYY-MM-DD للحظة معيّنة بتوقيت المنطقة */
export function dateInTz(date: Date | string, timeZone = DEFAULT_TZ): string {
  return fmt(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA').format(
    new Date(date),
  )
}

export function todayInTz(timeZone = DEFAULT_TZ): string {
  return dateInTz(new Date(), timeZone)
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number) as [number, number, number]
  const [y2, m2, d2] = to.split('-').map(Number) as [number, number, number]
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (1440 * MINUTE_MS))
}

/** 0 = الأحد … 6 = السبت */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function dayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10))
}

/** بداية الأسبوع (السبت) */
export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -((weekdayOf(dateStr) + 1) % 7))
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

export function endOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function addMonths(dateStr: string, months: number): string {
  const [y, m] = dateStr.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10)
}

/** إزاحة المنطقة عن UTC بالدقائق في لحظة معيّنة */
export function tzOffsetMinutes(date: Date, timeZone = DEFAULT_TZ): number {
  const parts = Object.fromEntries(
    fmt(
      timeZone,
      {
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      },
      'en-US',
    )
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE_MS)
}

/** "YYYY-MM-DD" + "HH:mm" بتوقيت الصالون → ISO UTC */
export function zonedToIso(dateStr: string, time: string, timeZone = DEFAULT_TZ): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  const [h, min] = time.split(':').map(Number) as [number, number]
  const guess = Date.UTC(y, m - 1, d, h, min)
  let offset = tzOffsetMinutes(new Date(guess), timeZone)
  const corrected = tzOffsetMinutes(new Date(guess - offset * MINUTE_MS), timeZone)
  if (corrected !== offset) offset = corrected
  return new Date(guess - offset * MINUTE_MS).toISOString()
}

/** HH:mm (24 ساعة) للحظة بتوقيت الصالون — لحقول input[type=time] */
export function timeInTz(date: Date | string, timeZone = DEFAULT_TZ): string {
  return fmt(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'en-GB').format(
    new Date(date),
  )
}

/** "4:30 م" */
export function formatTime(date: Date | string, timeZone = DEFAULT_TZ): string {
  return fmt(timeZone, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(date))
}

/** "4:30" بلا ص/م — للعرض المضغوط */
export function formatClock(date: Date | string, timeZone = DEFAULT_TZ): string {
  return fmt(timeZone, { hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(new Date(date))
    .filter((p) => p.type === 'hour' || p.type === 'minute' || p.type === 'literal')
    .map((p) => p.value)
    .join('')
    .trim()
}

/** "م" أو "ص" */
export function formatMeridiem(date: Date | string, timeZone = DEFAULT_TZ): string {
  return (
    fmt(timeZone, { hour: 'numeric', hour12: true })
      .formatToParts(new Date(date))
      .find((p) => p.type === 'dayPeriod')?.value ?? ''
  )
}

export function formatTimeRange(start: Date | string, end: Date | string, timeZone = DEFAULT_TZ) {
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`
}

/** تاريخ YYYY-MM-DD كنص عربي: "الخميس 16 تشرين الأول" */
export function formatDateLong(dateStr: string, withYear = false): string {
  return fmt('UTC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(new Date(`${dateStr}T12:00:00Z`))
}

/** "16 تشرين الأول" */
export function formatDateShort(dateStr: string, withYear = false): string {
  return fmt('UTC', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(new Date(`${dateStr}T12:00:00Z`))
}

export function formatMonth(dateStr: string): string {
  return fmt('UTC', { month: 'long', year: 'numeric' }).format(new Date(`${dateStr}T12:00:00Z`))
}

/** اليوم / غداً / أمس / بعد غد، وإلا اسم اليوم والتاريخ */
export function relativeDayLabel(dateStr: string, today: string): string {
  const diff = diffDays(today, dateStr)
  if (diff === 0) return 'اليوم'
  if (diff === 1) return 'غداً'
  if (diff === -1) return 'أمس'
  if (diff === 2) return 'بعد غد'
  return formatDateLong(dateStr)
}

/** تاريخ ووقت لحظة: "الخميس 16 تشرين الأول · 4:30 م" */
export function formatDateTime(date: Date | string, timeZone = DEFAULT_TZ): string {
  return `${formatDateLong(dateInTz(date, timeZone))} · ${formatTime(date, timeZone)}`
}

export function minutesBetween(start: Date | string, end: Date | string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / MINUTE_MS)
}
