/**
 * رموز الحركة للشيفرة البرمجية (WAAPI وغيرها).
 * المصدر المقابل في CSS: assets/css/main.css (`--motion-*` و`--ease-*`) —
 * يضمن tests/motion.test.ts تطابق القيمتين.
 */

/** المدد بالميلي ثانية */
export const MOTION = {
  instant: 100,
  fast: 150,
  base: 220,
  slow: 320,
  page: 260,
} as const

/** المنحنيات: دخول (out) وخروج (in) وتحريك موضع (inOut) ونقرة صغيرة (spring) */
export const EASING = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

/** الخروج أسرع من الدخول بهذه النسبة */
export const EXIT_RATIO = 0.65

export function exitDuration(enterMs: number): number {
  return Math.round(enterMs * EXIT_RATIO)
}

/** هل يفضّل المستخدم تقليل الحركة؟ (آمن على الخادم: false) */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** تباطؤ ثلاثي في النهاية (للعدّ التصاعدي): يبدأ سريعاً ويستقر برفق */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

/**
 * قيمة العدّاد عند تقدّم معيّن. بين عددين صحيحين تُقرَّب كل خطوة كي لا يظهر كسر أثناء العدّ،
 * وفي سواهما تبقى القيمة عشرية (النسب المئوية مثلاً).
 */
export function tweenValue(from: number, to: number, progress: number): number {
  if (progress >= 1) return to
  const value = from + (to - from) * easeOutCubic(progress)
  return Number.isInteger(from) && Number.isInteger(to) ? Math.round(value) : value
}
