/**
 * يضبط اتجاه انتقال الصفحة لكل تنقل (انظر utils/route-motion.ts).
 * - بعد أن تغادر الصفحة القديمة نصفّر التمرير للأعلى قبل دخول الجديدة، فلا يرى المستخدم قفزة
 *   (Nuxt يمرّر بعد انتهاء الانتقال كله). عند أزرار المتصفح نترك استعادة الموضع لـ vue-router.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  // العلم يخصّ هذا التنقل وحده: نلتقطه ونصفّره فلا يتسرّب إلى تنقل لاحق
  const isPop = navigationState.pop
  navigationState.pop = false

  to.meta.pageTransition = {
    name: resolvePageTransition(from.path, to.path),
    mode: 'out-in',
    onAfterLeave: () => {
      if (!isPop) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    },
  }
})
