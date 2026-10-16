/** تنسيق المبالغ والمدد والأرقام — ملف نقي يُختبر عبر node --test */

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const numberFormat = new Intl.NumberFormat('ar-SY-u-nu-latn')

/** يحوّل الأرقام العربية/الفارسية إلى لاتينية (لوحات المفاتيح العربية على الموبايل) */
export function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (d) => {
    const index = ARABIC_DIGITS.indexOf(d)
    return String(index >= 0 ? index : PERSIAN_DIGITS.indexOf(d))
  })
}

/** يستخرج عدداً صحيحاً من إدخال حر ("25,000" أو "٢٥٠٠٠") أو null */
export function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  if (typeof value !== 'string') return null
  const digits = toLatinDigits(value).replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

/** قيمة حقل نموذج → عدد أو null (للحقول الرقمية المربوطة بـ FormField) */
export function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : parseInteger(value)
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** "25,000 ل.س" */
export function formatMoney(value: number | null | undefined): string {
  return `${formatNumber(value ?? 0)} ل.س`
}

/** مبلغ مختصر للمحاور والبطاقات الصغيرة: 1.2 مليون / 350 ألف */
export function formatMoneyCompact(value: number): string {
  if (value >= 1_000_000) return `${trimDecimal(value / 1_000_000)} مليون`
  if (value >= 1_000) return `${trimDecimal(value / 1_000)} ألف`
  return formatNumber(value)
}

function trimDecimal(value: number): string {
  return formatNumber(Math.round(value * 10) / 10)
}

/** 90 → "ساعة و30 د" — 45 → "45 دقيقة" — 120 → "ساعتان" */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} دقيقة`
  const hours = h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${h} ساعات`
  return m ? `${hours} و${m} د` : hours
}

/** ساعات العمل للإحصائيات: 754 → "12.6 ساعة" */
export function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${formatNumber(hours)} ساعة`
}

/** نسبة التغيّر بين فترتين (null إن لم تكن الفترة السابقة ذات معنى) */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return Math.round(((current - previous) / previous) * 100)
}

/** رقم سوري محلي (09xxxxxxxx) → صيغة دولية لروابط واتساب (9639xxxxxxxx) */
export function toInternationalPhone(phone: string, countryCode = '963'): string {
  const digits = toLatinDigits(phone).replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits.slice(1)
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return countryCode + digits.slice(1)
  return digits
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${toInternationalPhone(phone)}?text=${encodeURIComponent(text)}`
}

/** الحرف الأول من الاسم للصور الرمزية */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join(' ')
}
