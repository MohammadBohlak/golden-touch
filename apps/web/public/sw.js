/*
 * Service Worker لإشعارات Web Push فقط (docs/PUSH_NOTIFICATIONS_PLAN.md §5.4).
 * بلا مستمع fetch ولا كاش — فلا يمسّ SSR ولا تنقّل الصفحات ولا سجل المتصفح.
 * كل push يعرض إشعاراً دائماً (شرط Apple، وإلا تسحب الإذن)، حتى لو فشل تحليل المحتوى.
 * المحتوى: { title, body, tag } — اسم الزبون والخدمة والوقت فقط، بلا مال ولا هاتف.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (error) {
    data = {}
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'Golden Touch'
  const body = typeof data.body === 'string' && data.body ? data.body : 'لديك إشعار جديد'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      // وسم الحجز: إعادة إرسال الحجز نفسه تستبدل إشعاره ولا تكرّره
      tag: typeof data.tag === 'string' && data.tag ? data.tag : 'golden-touch',
      renotify: true,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: '/' },
    }),
  )
})

// D4: النقر يفتح أجندة اليوم (/). إن كان التطبيق مفتوحاً نكتفي بإظهاره كي لا نقطع ما يعمل عليه المستخدم.
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
