const ARABIC_DIGITS = /[٠-٩]/g

/** أقل طول للرقم الوطني (بلا 0 ولا 963) كي يُعدّ سورياً في المطابقة */
const MIN_NATIONAL_LENGTH = 6

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

/**
 * الرقم الوطني السوري (بلا 0 ولا مفتاح الدولة) من رقم مُوحَّد بـ normalizePhone، أو null
 * إن لم تكن صيغته سورية: `0991234567` و`963991234567` و`+963991234567` و`00963991234567` ← `991234567`.
 */
export function syrianNational(normalized: string): string | null {
  const international = normalized.startsWith('+')
  const digits = international ? normalized.slice(1) : normalized
  let national: string | null = null
  if (digits.startsWith('00963')) national = digits.slice(5)
  else if (digits.startsWith('963')) national = digits.slice(3)
  else if (!international && digits.startsWith('0') && !digits.startsWith('00'))
    national = digits.slice(1)
  return national && national.length >= MIN_NATIONAL_LENGTH ? national : null
}

/**
 * كل الصيغ التي قد يكون الرقم مخزّناً بها (يخزَّن كما أُدخل لا بصيغة موحّدة)، لمطابقة
 * `0` و`963` و`+963` و`00963` كرقم واحد. غير السوري: الرقم نفسه فقط.
 */
export function phoneVariants(normalized: string): string[] {
  const national = syrianNational(normalized)
  if (!national) return [normalized]
  return [...new Set([normalized, `0${national}`, `963${national}`, `+963${national}`, `00963${national}`])]
}

export type PhoneFilter = { contains: string } | { startsWith: string }

/**
 * شروط البحث بالهاتف (تُجمع بـ OR) بحيث تطابق كل صيغ الرقم المخزّنة، حتى أثناء الكتابة:
 * `0991` أو `+96399` أو `96399` تجد `0991…` و`963991…` و`+963991…` و`00963991…`.
 * ما أُدخل يبقى بحثاً بالاحتواء كما كان (آخر الرقم مثلاً)؛ وللبادئة السورية تُضاف صيغ
 * البداية الأخرى بـ startsWith كي لا تتسع النتائج لأي رقم يحوي «09» في وسطه.
 */
export function phoneSearchFilters(search: string | null | undefined): PhoneFilter[] {
  const phone = normalizePhone(search)
  if (!phone) return []
  const filters: PhoneFilter[] = [{ contains: phone }]
  const international = phone.startsWith('+')
  const digits = international ? phone.slice(1) : phone
  let partial: string | null = null
  if (digits.startsWith('00963')) partial = digits.slice(5)
  else if (digits.startsWith('963')) partial = digits.slice(3)
  else if (!international && digits.startsWith('0') && !digits.startsWith('00'))
    partial = digits.slice(1)
  if (partial) {
    for (const prefix of ['0', '963', '+963', '00963']) {
      const starts = `${prefix}${partial}`
      if (starts !== phone) filters.push({ startsWith: starts })
    }
  }
  return filters
}
