/**
 * منطق نقي لاقتراحات الزبائن أثناء الكتابة (بحث بنمط «اقتراحات جوجل») — يُختبر عبر node --test.
 * المطابقة والإبراز بتوحيد الحروف العربية («احمد» تطابق «أحمد»، والتشكيل يُهمل) كما في بحث الخادم.
 */
import { FOLD_FROM, FOLD_TO, isDiacritic, normalizeArabic } from './arabic.ts'

export interface HighlightParts {
  before: string
  match: string
  after: string
}

/** النص موحَّداً مع موضع كل حرف منه في النص الأصلي (الحذف والضغط يغيّران الأطوال) */
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string
    if (isDiacritic(char)) continue
    if (/\s/.test(char)) {
      if (folded && !folded.endsWith(' ')) {
        folded += ' '
        map.push(i)
      }
      continue
    }
    for (const piece of char.toLowerCase()) {
      const at = FOLD_FROM.indexOf(piece)
      folded += at >= 0 ? (FOLD_TO[at] as string) : piece
      map.push(i)
    }
  }
  if (folded.endsWith(' ')) {
    folded = folded.slice(0, -1)
    map.pop()
  }
  return { folded, map }
}

/** يقسم النص حول أول تطابق موحَّد مع الحفاظ على النص الأصلي كما هو (بتشكيله وهمزاته) */
export function splitHighlight(text: string, query: string): HighlightParts {
  const q = normalizeArabic(query)
  const { folded, map } = foldWithMap(text)
  const index = q ? folded.indexOf(q) : -1
  if (index < 0) return { before: text, match: '', after: '' }
  const start = map[index] as number
  let end = (map[index + q.length - 1] as number) + 1
  // التشكيل التابع لآخر حرف مطابَق يدخل في الإبراز
  while (end < text.length && isDiacritic(text[end] as string)) end++
  return { before: text.slice(0, start), match: text.slice(start, end), after: text.slice(end) }
}

/** البحث بالهاتف: أرقام وفواصل فقط (٣ خانات فأكثر تُحسب في الواجهة قبل الاستدعاء) */
const PHONE_LIKE = /^[\d\s+()\-٠-٩]+$/

/**
 * يرتّب اقتراحات الخادم كما يتوقعها المستخدم: ما يبدأ اسمه بما كُتب أولاً ثم ما يحويه،
 * وداخل كل مجموعة يبقى ترتيب الخادم (الأحدث نشاطاً). ويستبعد ما لم يعد يطابق ما كُتب بعد
 * وصول الاستجابة (المستخدم تابع الكتابة) فتبقى القائمة صادقة قبل وصول الطلب التالي.
 * المطابقة بتوحيد الحروف العربية. استعلام الهاتف يُترك كما أرجعه الخادم.
 */
export function rankSuggestions<T extends { name: string }>(
  items: readonly T[],
  query: string,
  limit = 6,
): T[] {
  const raw = query.trim()
  if (!raw) return []
  if (PHONE_LIKE.test(raw)) return items.slice(0, limit)
  const q = normalizeArabic(raw)
  const starts: T[] = []
  const contains: T[] = []
  for (const item of items) {
    const name = normalizeArabic(item.name)
    if (name.startsWith(q)) starts.push(item)
    else if (name.includes(q)) contains.push(item)
  }
  return [...starts, ...contains].slice(0, limit)
}
