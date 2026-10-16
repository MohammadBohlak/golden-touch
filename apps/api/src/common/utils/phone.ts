const ARABIC_DIGITS = /[٠-٩]/g

/**
 * توحيد رقم الهاتف للتخزين والبحث: تحويل الأرقام العربية إلى لاتينية وإزالة الرموز.
 * يُبقي "+" في البداية فقط. يعيد null للنص الفارغ.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null
  const latin = value.replace(ARABIC_DIGITS, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const trimmed = latin.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  return trimmed.startsWith('+') ? `+${digits}` : digits
}
