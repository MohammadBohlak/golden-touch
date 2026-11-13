/**
 * توحيد النص العربي للبحث: «احمد» تطابق «أحمد»، و«فاطمه» تطابق «فاطمة»، والتشكيل والتطويل يُهملان.
 * ملف نقي بلا استيرادات: النسخة نفسها (الثوابت والسلوك) في apps/web/app/utils/arabic.ts، ويثبّت
 * apps/web/tests/suggest.test.ts تطابقهما. والخادم يطبّق المعادلة نفسها في SQL (name-search.ts).
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
