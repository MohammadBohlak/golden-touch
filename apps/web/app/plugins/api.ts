/**
 * $api: نسخة من ofetch مضبوطة على الـ API.
 * - على المتصفح: /api (نفس الأصل — Nitro يمرّرها للـ backend فيبقى الكوكي بلا CORS)
 * - أثناء SSR: مباشرة إلى API_BASE_URL مع تمرير ترويسة cookie من الطلب الوارد
 * - عند 401 على المتصفح: تفريغ الجلسة والتوجيه إلى /login?redirect=…
 */
export default defineNuxtPlugin({
  name: 'api',
  setup() {
    const config = useRuntimeConfig()
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

    const api = $fetch.create({
      baseURL: import.meta.server ? `${config.apiBaseUrl}/api` : '/api',
      credentials: 'include',
      headers,
      retry: 0,
      timeout: 20_000,
      async onResponseError({ request, response }) {
        if (!import.meta.client || response.status !== 401) return
        const url = typeof request === 'string' ? request : request.url
        if (url.includes('/auth/login') || url.includes('/auth/me')) return

        useAuthStore().clear()
        const route = useRouter().currentRoute.value
        if (route.path !== '/login') {
          useToast().info('انتهت الجلسة، سجّل الدخول مجدداً')
          await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
        }
      },
    })

    return { provide: { api } }
  },
})
