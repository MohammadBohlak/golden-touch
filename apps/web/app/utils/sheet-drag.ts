/** قرار إغلاق الورقة السفلية بالسحب. منطق نقي يُختبر مباشرة (tests/sheet-drag.test.ts). */

/** نسبة السحب من ارتفاع الورقة التي تكفي للإغلاق */
export const SHEET_DISMISS_RATIO = 0.3
/** سرعة سحب لأسفل (بكسل/مللي ثانية) تعدّ «قذفاً» */
export const SHEET_FLING_VELOCITY = 0.5
/** أدنى مسافة تُحتسب معها السرعة (يمنع إغلاقاً بنقرة خفيفة) */
export const SHEET_FLING_MIN_DISTANCE = 40

export function shouldDismissSheet(dy: number, height: number, velocity: number): boolean {
  if (dy <= 0 || height <= 0) return false
  if (dy >= height * SHEET_DISMISS_RATIO) return true
  return velocity >= SHEET_FLING_VELOCITY && dy >= SHEET_FLING_MIN_DISTANCE
}

/** نسبة السحب (0..1) لتخفيف عتمة الخلفية أثناء السحب */
export function dragProgress(dy: number, height: number): number {
  if (height <= 0) return 0
  return Math.min(1, Math.max(0, dy / height))
}

/** قرار إخفاء إشعار بالسحب الأفقي (أي اتجاه): ثلث العرض، أو قذف سريع بعد مسافة دنيا */
export function shouldDismissSwipe(dx: number, width: number, velocity: number): boolean {
  const distance = Math.abs(dx)
  if (width <= 0 || distance === 0) return false
  if (distance >= width * 0.35) return true
  return (
    Math.abs(velocity) >= SHEET_FLING_VELOCITY &&
    distance >= 30 &&
    Math.sign(velocity) === Math.sign(dx)
  )
}
