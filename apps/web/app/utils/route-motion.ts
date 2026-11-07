/**
 * اتجاه انتقال الصفحة حسب «عمق» المسار:
 * أعمق ⇐ forward (تدخل الصفحة الجديدة من جهة النهاية)، أقل ⇐ back، نفس المستوى ⇐ fade.
 * منطق نقي بلا اعتماديات Nuxt ليُختبر مباشرة (tests/route-motion.test.ts).
 */

export type PageTransitionName = 'page-forward' | 'page-back' | 'page-fade'

/** صفحات فرعية لا تعكس عمقها بنية المسار (مثل /account الذي يُفتح من /more) */
const EXTRA_DEPTH: Record<string, number> = { '/account': 1 }

/** عمق المسار: الوجهات الرئيسية 0، تفاصيل/إنشاء 1، تعديل تفصيل 2 */
export function routeDepth(path: string): number {
  const clean = path.split(/[?#]/)[0] ?? '/'
  if (clean in EXTRA_DEPTH) return EXTRA_DEPTH[clean]!
  const segments = clean.split('/').filter(Boolean)
  return Math.max(0, segments.length - 1)
}

export function resolvePageTransition(fromPath: string, toPath: string): PageTransitionName {
  const from = routeDepth(fromPath)
  const to = routeDepth(toPath)
  if (to > from) return 'page-forward'
  if (to < from) return 'page-back'
  return 'page-fade'
}

/** حالة التنقل المشتركة بين البرنامج الوسيط والإضافة (يضبط popstate العلم قبل بدء التنقل) */
export const navigationState = { pop: false }
