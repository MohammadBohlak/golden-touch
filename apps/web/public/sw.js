/*
 * Service Worker لإشعارات Web Push فقط (docs/PUSH_NOTIFICATIONS_PLAN.md §5.4).
 * بلا مستمع fetch ولا كاش — فلا يمسّ SSR ولا تنقّل الصفحات.
 * كل push يعرض إشعاراً دائماً (شرط Apple، وإلا تسحب الإذن)، حتى لو فشل تحليل المحتوى.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

function formatDelay(seconds) {
  if (seconds < 60) return seconds + ' ث'
  const minutes = Math.floor(seconds / 60)
  return minutes + ' د ' + (seconds % 60) + ' ث'
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (error) {
    data = {}
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'Golden Touch'
  let body = typeof data.body === 'string' && data.body ? data.body : 'لديك إشعار جديد'
  // تجربة المرحلة 0: يحمل المحتوى وقت الإرسال فنعرض زمن الوصول الفعلي على الهاتف
  if (typeof data.sentAt === 'number') {
    const seconds = Math.round((Date.now() - data.sentAt) / 1000)
    if (seconds >= 0 && seconds < 86400) body += ' · وصل بعد ' + formatDelay(seconds)
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: typeof data.tag === 'string' && data.tag ? data.tag : 'golden-touch',
      renotify: true,
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      data: { url: '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => 'focus' in client)
      if (open) return open.focus()
      return self.clients.openWindow(target)
    }),
  )
})
