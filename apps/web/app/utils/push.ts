/** مساعدات Web Push النقية (بلا وصول إلى window) — docs/PUSH_NOTIFICATIONS_PLAN.md */

/** مفتاح VAPID العام يصل base64url؛ pushManager.subscribe يريده بايتات */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export interface PushEnvironment {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  isIos: boolean
  /** مفتوح كتطبيق (display-mode: standalone) لا كتبويب متصفح */
  isStandalone: boolean
}

export type PushSupport = 'ok' | 'needs-install' | 'unsupported'

/**
 * iPhone: Web Push لتطبيق الويب المضاف إلى الشاشة الرئيسية فقط، فمن Safari العادي
 * تغيب PushManager وتحتاج خطوات «إضافة إلى الشاشة الرئيسية» لا رسالة «غير مدعوم».
 */
export function pushSupport(env: PushEnvironment): PushSupport {
  if (env.isIos && !env.isStandalone) return 'needs-install'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  return 'ok'
}
