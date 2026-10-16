/** المسارات المتاحة بلا تسجيل دخول — قائمة واحدة */
const PUBLIC_ROUTES = ['/login']

/** يمنع إعادة التوجيه إلى مواقع خارجية عبر ?redirect= */
function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  const isPublic = PUBLIC_ROUTES.includes(to.path)

  if (!auth.loaded) await auth.fetchMe()

  if (!auth.user) {
    if (isPublic) return
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.path === '/login') return navigateTo(safeRedirect(to.query.redirect), { replace: true })

  const { has } = usePermission()
  if (to.meta.permission && !has(to.meta.permission)) {
    if (import.meta.client) useToast().error('ليس لديك صلاحية لفتح هذه الصفحة')
    return navigateTo(to.path === '/' ? '/account' : '/', { replace: true })
  }
})
