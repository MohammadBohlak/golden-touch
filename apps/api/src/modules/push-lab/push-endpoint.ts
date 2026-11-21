/**
 * حماية SSRF: الخادم يرسل POST إلى عنوان يقدّمه المستخدم (endpoint الاشتراك)، فنقبل
 * `https` ومضيفاً من خدمات Push المعروفة فقط — docs/PUSH_NOTIFICATIONS_PLAN.md §5.3.
 */
const ALLOWED_HOSTS: Array<string | RegExp> = [
  'fcm.googleapis.com', // Chrome / Edge / Samsung Internet على Android
  /(^|\.)push\.apple\.com$/, // Safari / تطبيقات الويب على iPhone
  /(^|\.)push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)notify\.windows\.com$/, // Edge على Windows
]

export function isAllowedPushEndpoint(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  const host = url.hostname.toLowerCase()
  return ALLOWED_HOSTS.some((allowed) =>
    typeof allowed === 'string' ? host === allowed : allowed.test(host),
  )
}
