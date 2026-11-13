/**
 * توحيد النص العربي للبحث: «احمد» تطابق «أحمد»، و«فاطمه» تطابق «فاطمة»، والتشكيل والتطويل يُهملان.
 * نسخة الواجهة من apps/api/src/common/utils/arabic.ts (لا حزمة مشتركة في المشروع): يثبّت
 * tests/suggest.test.ts تطابقهما على عيّنات، فعدّلهما معاً. الخادم يطبّق المعادلة نفسها في SQL.
 *
 * القواعد: أحرف لاتينية صغيرة · حذف التشكيل (ً–ٟ ٰ) والتطويل (ـ) · أ إ آ ٱ ← ا · ى ← ي · ة ← ه
 * · ؤ ← و · ئ ← ي · ضغط المسافات المتتالية وقصّ الأطراف.
 */
export const DIACRITICS_CLASS = '\u064B-\u065F\u0670\u0640'
export const FOLD_FROM = 'أإآٱىةؤئ'
export const FOLD_TO = 'اااايهوي'

const DIACRITICS = new RegExp(`[${DIACRITICS_CLASS}]`, 'g')
const FOLDABLE = new RegExp(`[${FOLD_FROM}]`, 'g')

export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(FOLDABLE, (ch) => FOLD_TO[FOLD_FROM.indexOf(ch)] as string)
    .replace(/\s+/g, ' ')
    .trim()
}

const DIACRITIC_ONE = new RegExp(`^[${DIACRITICS_CLASS}]$`)

/** حرف تشكيل أو تطويل (يُهمل في المطابقة) */
export function isDiacritic(char: string): boolean {
  return DIACRITIC_ONE.test(char)
}
