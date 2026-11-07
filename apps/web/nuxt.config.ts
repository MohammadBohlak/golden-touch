import tailwindcss from '@tailwindcss/vite'

const BRAND_BLACK = '#0C0A09'

/**
 * بوّابة popstate: سكربت مضمَّن في الـ head يعمل قبل حزمة التطبيق فيلفّ كل مستمعي popstate
 * (vue-router وNuxt وغيرهما) بفحص واحد لكل حدث. السبب: عند الهدف نفسه (window) تُنفَّذ المستمعات
 * بترتيب التسجيل لا بترتيب الالتقاط، ومستمع vue-router يُسجَّل قبل أي إضافة — فلا يمكن إيقافه
 * من داخل التطبيق. البوّابة (`window.__gtPopGate`) تُركَّب في plugins/00.back-navigation.client.ts؛
 * حين تعيد true يُبتلع الحدث ولا يصل لأي مستمع (مدخل حوار/حارس خروج، انظر utils/back-stack.ts).
 */
const POPSTATE_GATE = `(function(){
var add=window.addEventListener,remove=window.removeEventListener,wrappers=new WeakMap(),decisions=new WeakMap();
function gate(e){if(decisions.has(e))return decisions.get(e);var g=window.__gtPopGate,r=false;try{r=!!(g&&g(e))}catch(_){}decisions.set(e,r);return r}
window.__gtPopGateReady=true;
window.addEventListener=function(type,listener,options){
if(type==='popstate'&&listener){var w=wrappers.get(listener);
if(!w){w=function(e){if(gate(e))return;return typeof listener==='function'?listener.call(this,e):listener.handleEvent(e)};wrappers.set(listener,w)}
return add.call(this,type,w,options)}
return add.call(this,type,listener,options)};
window.removeEventListener=function(type,listener,options){
if(type==='popstate'&&listener&&wrappers.has(listener))listener=wrappers.get(listener);
return remove.call(this,type,listener,options)};
})();`

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: true,
  devtools: { enabled: false },

  modules: ['@pinia/nuxt', '@nuxt/fonts', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  // أسماء مكوّنات بلا بادئة المجلد: components/ui/AppButton.vue → <AppButton>
  components: [{ path: '~/components', pathPrefix: false }],
  vite: { plugins: [tailwindcss()] },
  // نسخة واحدة من Pinia في بناء الخادم: بدونها يُدمج جزء ويُستورد جزء خارجياً
  // فلا تجد الـ stores نسخة Pinia النشطة (خطأ 500 في الإنتاج فقط)
  build: { transpile: ['pinia'] },

  app: {
    // الاتجاه الفعلي يُضبط لكل تنقل في middleware/page-transition.global.ts؛ هذا الافتراضي للتحميل الأول
    pageTransition: { name: 'page-fade', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      script: [{ innerHTML: POPSTATE_GATE, tagPosition: 'head', tagPriority: 'critical' }],
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
      title: 'Golden Touch',
      titleTemplate: '%s · Golden Touch',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'إدارة مواعيد صالون Golden Touch — اللمسة الذهبية' },
        { name: 'theme-color', content: BRAND_BLACK },
        { name: 'color-scheme', content: 'light' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
        { name: 'apple-mobile-web-app-title', content: 'Golden Touch' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    },
  },

  fonts: {
    families: [
      { name: 'Cairo', provider: 'google', weights: [400, 500, 600, 700, 800], global: true },
    ],
    defaults: { subsets: ['arabic', 'latin'] },
  },

  runtimeConfig: {
    // خاص بالخادم: عنوان الـ API الذي تُمرَّر إليه /api/** (قابل للتغيير وقت التشغيل عبر NUXT_API_BASE_URL)
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  },

  routeRules: {
    // صفحات لوحة داخلية: لا كاش على مستوى CDN
    '/**': { headers: { 'cache-control': 'no-store' } },
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },

  typescript: { strict: true },
})
