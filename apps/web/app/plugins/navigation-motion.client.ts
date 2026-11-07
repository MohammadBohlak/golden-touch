/**
 * - يميّز التنقل الناتج عن أزرار المتصفح (popstate) كي لا نصفّر التمرير فوق استعادة vue-router.
 *   مستمع الالتقاط يعمل قبل مستمع vue-router فيُضبط العلم قبل تشغيل الحراس، ويستهلكه
 *   البرنامج الوسيط page-transition.global.ts.
 * - بعد انتهاء انتقال الصفحة ننقل التركيز إلى المحتوى الرئيسي (قارئ الشاشة/لوحة المفاتيح)،
 *   دون سرقته إن كان داخل المحتوى أصلاً.
 */
export default defineNuxtPlugin((nuxtApp) => {
  window.addEventListener(
    'popstate',
    () => {
      navigationState.pop = true
    },
    { capture: true },
  )

  nuxtApp.hook('page:transition:finish', () => {
    const main = document.getElementById('main')
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true })
  })
})
