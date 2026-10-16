/**
 * تمرير /api/** إلى الـ backend (NestJS) من نفس أصل الواجهة:
 * الكوكي httpOnly يعمل بلا CORS، وعنوان الـ API يُقرأ وقت التشغيل من runtimeConfig.
 */
export default defineEventHandler((event) => {
  const { apiBaseUrl } = useRuntimeConfig(event)
  const target = new URL(event.path, apiBaseUrl)
  const clientIp = getRequestIP(event, { xForwardedFor: true })

  return proxyRequest(event, target.toString(), {
    headers: clientIp ? { 'x-forwarded-for': clientIp } : undefined,
  })
})
