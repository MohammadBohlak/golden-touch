import type { PushPublicKey, PushTestResult } from '~/types/api'
import { platformOf, pushSupport, urlBase64ToUint8Array, type PushPlatform } from '~/utils/push'

/**
 * حالة إشعارات المواعيد على هذا الجهاز (docs/PUSH_NOTIFICATIONS_PLAN.md §5.4).
 *  - needs-install: iPhone في Safari غير مضاف للشاشة الرئيسية (يتطلبه Web Push على iOS)
 *  - server-off: مفاتيح VAPID غير مضبوطة على الخادم (503)
 */
export type PushState =
  'checking' | 'off' | 'on' | 'denied' | 'needs-install' | 'unsupported' | 'server-off'

/** أقصى انتظار لإلغاء الاشتراك عند تسجيل الخروج: لا نعطّل الخروج على شبكة بطيئة */
const RELEASE_TIMEOUT_MS = 4000

/** استدعاءان متزامنان (التخطيط وقسم الحساب) يتشاركان دورة واحدة */
let initRun: Promise<void> | null = null

export function usePush() {
  const { $api } = useNuxtApp()
  const toast = useToast()

  const state = useState<PushState>('push-state', () => 'checking')
  const platform = useState<PushPlatform>('push-platform', () => 'other')
  const busy = useState('push-busy', () => false)
  /** مفتاح VAPID العام: يُجلب قبل نقرة التفعيل لأن iPhone يشترط طلب الإذن مباشرة من النقرة */
  const publicKey = useState<string | null>('push-key', () => null)

  async function registration(): Promise<ServiceWorkerRegistration> {
    await navigator.serviceWorker.register('/sw.js')
    return navigator.serviceWorker.ready
  }

  /** null = الخادم بلا مفاتيح (503) أو فشل الجلب */
  async function loadKey(): Promise<string | null> {
    if (publicKey.value) return publicKey.value
    try {
      publicKey.value = (await $api<PushPublicKey>('/push/public-key')).publicKey
    } catch (error) {
      if (toApiError(error).status === 503) state.value = 'server-off'
      return null
    }
    return publicKey.value
  }

  /** الاشتراك المحلي مرتبط بمفتاح VAPID؛ تغيّر المفتاح على الخادم يلزمه اشتراك جديد */
  function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
    const current = sub.options.applicationServerKey
    if (!current) return false
    const bytes = new Uint8Array(current)
    return bytes.length === key.length && bytes.every((b, i) => b === key[i])
  }

  async function ensureSubscription(
    reg: ServiceWorkerRegistration,
    key: string,
  ): Promise<PushSubscription> {
    const bytes = urlBase64ToUint8Array(key)
    const existing = await reg.pushManager.getSubscription()
    if (existing && sameKey(existing, bytes)) return existing
    await existing?.unsubscribe()
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
  }

  /** يسجّل الجهاز على الخادم (upsert) ويحدّث lastSeenAt */
  async function register(sub: PushSubscription): Promise<void> {
    const { endpoint, keys } = sub.toJSON()
    await $api('/push/subscriptions', { method: 'POST', body: { endpoint, keys } })
  }

  /**
   * يُستدعى عند فتح التطبيق وعند فتح قسم الإشعارات: يحدّد الحالة، وإن كان الإذن ممنوحاً
   * يجدّد lastSeenAt أو يعيد الاشتراك تلقائياً إن ضاع (مسح بيانات الموقع، تغيّر المفتاح).
   */
  function init(): Promise<void> {
    if (!import.meta.client) return Promise.resolve()
    initRun ??= runInit().finally(() => (initRun = null))
    return initRun
  }

  async function runInit(): Promise<void> {
    platform.value = platformOf(navigator.userAgent, navigator.maxTouchPoints)
    const support = pushSupport({
      hasServiceWorker: 'serviceWorker' in navigator,
      hasPushManager: 'PushManager' in window,
      hasNotification: 'Notification' in window,
      isIos: platform.value === 'ios',
      isStandalone:
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    })
    if (support !== 'ok') {
      state.value = support
      return
    }
    if (Notification.permission === 'denied') {
      state.value = 'denied'
      return
    }
    if (Notification.permission !== 'granted') {
      state.value = 'off'
      return
    }
    try {
      const key = await loadKey()
      if (!key) return // server-off (loadKey ضبطها) أو شبكة: تبقى الحالة السابقة
      await register(await ensureSubscription(await registration(), key))
      state.value = 'on'
    } catch {
      // فشل صامت عند فتح التطبيق؛ الإذن ممنوح فنعرض «مفعّلة» ويعاد الاشتراك في الفتح التالي
      if (state.value === 'checking') state.value = 'on'
    }
  }

  async function enable(): Promise<void> {
    const key = publicKey.value ?? (await loadKey())
    if (!key) return void (state.value !== 'server-off' && toast.error('تعذّر الاتصال بالخادم'))
    busy.value = true
    try {
      // الإذن أول await بعد النقرة (شرط iPhone)
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        state.value = permission === 'denied' ? 'denied' : 'off'
        return
      }
      await register(await ensureSubscription(await registration(), key))
      state.value = 'on'
      toast.success('تم تفعيل الإشعارات')
    } catch (error) {
      toast.error(toApiError(error).message || 'تعذّر تفعيل الإشعارات')
    } finally {
      busy.value = false
    }
  }

  async function disable(): Promise<void> {
    busy.value = true
    try {
      await release()
      state.value = 'off'
      toast.success('أُوقفت الإشعارات على هذا الجهاز')
    } catch (error) {
      toast.error(toApiError(error).message)
    } finally {
      busy.value = false
    }
  }

  async function test(): Promise<void> {
    busy.value = true
    try {
      const result = await $api<PushTestResult>('/push/test', { method: 'POST' })
      if (result.sent > 0) toast.success('أُرسل الإشعار التجريبي')
      else if (result.removed > 0) {
        state.value = 'off'
        toast.error('سقط الاشتراك، فعّل الإشعارات من جديد')
      } else toast.error('تعذّر إيصال الإشعار، حاول لاحقاً')
    } catch (error) {
      toast.error(toApiError(error).message)
    } finally {
      busy.value = false
    }
  }

  /** يحذف اشتراك هذا الجهاز من الخادم ثم من المتصفح */
  async function release(timeout?: number): Promise<void> {
    if (!('serviceWorker' in navigator)) return
    const sub = await (
      await navigator.serviceWorker.getRegistration('/')
    )?.pushManager.getSubscription()
    if (!sub) return
    await $api('/push/subscriptions', {
      method: 'DELETE',
      body: { endpoint: sub.endpoint },
      timeout,
    })
    await sub.unsubscribe()
  }

  /**
   * عند تسجيل الخروج: الجهاز المشترك لا يستمر باستلام أسماء الزبائن بعد خروج صاحبه.
   * لا يرمي أبداً ولا يعطّل الخروج؛ إن فشل الحذف (شبكة) يبقى الاشتراك حتى يسقط بـ 410 أو بمرور 30 يوماً.
   */
  async function releaseDevice(): Promise<void> {
    if (!import.meta.client) return
    try {
      await release(RELEASE_TIMEOUT_MS)
    } catch {
      // مقصود: الخروج أهم
    }
    state.value = 'checking'
  }

  return { state, platform, busy, publicKey, init, loadKey, enable, disable, test, releaseDevice }
}
