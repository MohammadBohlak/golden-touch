<script setup lang="ts">
/**
 * المرحلة 0 من docs/PUSH_NOTIFICATIONS_PLAN.md — صفحة تجربة مؤقتة (تُحذف مع بدء المرحلة 1).
 * تثبت على هاتف المدير الفعلي: وصول الإشعار، زمنه، صوته واهتزازه، والموقع مغلق/الهاتف مقفل.
 */
import type { PushLabStatus } from '~/types/api'
import { formatTime } from '~/utils/datetime'
import { pushSupport, urlBase64ToUint8Array } from '~/utils/push'

definePageMeta({ title: 'تجربة الإشعارات', permission: 'settings.update' })

type PushState = 'checking' | 'off' | 'on' | 'denied' | 'needs-install' | 'unsupported'

const { $api } = useNuxtApp()
const toast = useToast()

const state = ref<PushState>('checking')
const busy = ref(false)
const standalone = ref(false)

const status = useApiState((signal) => $api<PushLabStatus>('/push-lab/status', { signal }), {
  immediate: true,
})

const DELAYS = [
  { seconds: 5, label: 'بعد 5 ثوانٍ' },
  { seconds: 60, label: 'بعد دقيقة' },
  { seconds: 600, label: 'بعد 10 دقائق' },
  { seconds: 1800, label: 'بعد 30 دقيقة' },
]

const CHECKLIST = [
  'الإعدادات ← التطبيقات ← Chrome ← توفير البطارية ← «بلا قيود».',
  'الإعدادات ← التطبيقات ← Chrome ← «التشغيل التلقائي» مفعّل.',
  'الإعدادات ← الإشعارات ← Chrome ← الأهمية «عالية» والصوت مفعّل.',
  'في قائمة التطبيقات الأخيرة: اضغط مطولاً على Chrome ← «قفل».',
  'الهاتف ليس على الصامت ولا «عدم الإزعاج».',
]

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
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
  publicKey: string,
): Promise<PushSubscription> {
  const key = urlBase64ToUint8Array(publicKey)
  const existing = await reg.pushManager.getSubscription()
  if (existing && sameKey(existing, key)) return existing
  await existing?.unsubscribe()
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
}

async function sendSubscription(sub: PushSubscription): Promise<void> {
  const { endpoint, keys } = sub.toJSON()
  await $api('/push-lab/subscriptions', { method: 'POST', body: { endpoint, keys } })
}

async function detect(): Promise<void> {
  standalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const support = pushSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isStandalone: standalone.value,
  })
  if (support !== 'ok') {
    state.value = support
    return
  }
  if (Notification.permission === 'denied') {
    state.value = 'denied'
    return
  }
  try {
    const sub = await (await registration()).pushManager.getSubscription()
    state.value = sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    state.value = 'unsupported'
  }
}

/** الخادم يحفظ الاشتراكات في الذاكرة (تجربة): بعد إعادة تشغيله نعيد تسجيل جهازنا تلقائياً */
async function resyncIfNeeded(): Promise<void> {
  const data = status.data.value
  if (state.value !== 'on' || !data?.enabled || !data.publicKey || data.subscriptions > 0) return
  try {
    await sendSubscription(await ensureSubscription(await registration(), data.publicKey))
    await status.refresh()
  } catch {
    // يبقى «مفعّل محلياً»؛ زر الإرسال يعرض الرسالة الدقيقة
  }
}

async function enable(): Promise<void> {
  const publicKey = status.data.value?.publicKey
  if (!publicKey) return void toast.error('الإشعارات غير مفعّلة على الخادم')
  busy.value = true
  try {
    // iPhone: الإذن والاشتراك مباشرة من النقرة، بلا طلب شبكة قبلهما
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      state.value = permission === 'denied' ? 'denied' : 'off'
      return
    }
    await sendSubscription(await ensureSubscription(await registration(), publicKey))
    state.value = 'on'
    toast.success('تم تفعيل الإشعارات')
    await status.refresh()
  } catch (error) {
    toast.error(toApiError(error).message || 'تعذّر تفعيل الإشعارات')
  } finally {
    busy.value = false
  }
}

async function disable(): Promise<void> {
  busy.value = true
  try {
    const sub = await (await registration()).pushManager.getSubscription()
    if (sub) {
      await $api('/push-lab/subscriptions', { method: 'DELETE', body: { endpoint: sub.endpoint } })
      await sub.unsubscribe()
    }
    state.value = 'off'
    await status.refresh()
  } catch (error) {
    toast.error(toApiError(error).message)
  } finally {
    busy.value = false
  }
}

const sending = ref<number | null>(null)

async function send(seconds: number): Promise<void> {
  sending.value = seconds
  try {
    await $api('/push-lab/send', { method: 'POST', body: { delaySeconds: seconds } })
    toast.success(seconds > 0 ? 'جُدول الإرسال — اقفل الهاتف وانتظر' : 'أُرسل')
    await status.refresh()
  } catch (error) {
    toast.error(toApiError(error).message)
  } finally {
    sending.value = null
  }
}

function inLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} ثانية`
  const minutes = Math.round(seconds / 60)
  return minutes === 1 ? 'دقيقة' : `${minutes} دقيقة`
}

let poll: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  await detect()
  await status.execute()
  await resyncIfNeeded()
  // تحديث صامت: العدّ التنازلي للمجدول وسجل الإرسال
  poll = setInterval(() => {
    if (!document.hidden && state.value === 'on') void status.refresh()
  }, 10_000)
})
onBeforeUnmount(() => clearInterval(poll))

const pending = computed(() => status.data.value?.pending ?? [])
const log = computed(() => status.data.value?.log ?? [])
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="تجربة الإشعارات" subtitle="مؤقتة — المرحلة 0" back="/more" />

    <FadeTransition>
      <LoadingState
        v-if="status.loading.value && !status.data.value"
        key="loading"
        variant="cards"
        :rows="2"
      />
      <ErrorState
        v-else-if="status.error.value && !status.data.value"
        key="error"
        :message="status.errorMessage.value"
        @retry="status.execute()"
      />
      <div v-else key="content" class="flex flex-col gap-4">
        <!-- الحالة -->
        <section class="rounded-3xl bg-surface p-4 shadow-card">
          <h2 class="mb-3 flex items-center gap-2 font-bold">
            <AppIcon name="info" :size="18" /> الحالة
          </h2>
          <ul class="flex flex-col gap-2 text-[15px]">
            <li class="flex items-center justify-between gap-3">
              <span>الخادم</span>
              <AppBadge
                :tone="status.data.value?.enabled ? 'success' : 'danger'"
                :icon="status.data.value?.enabled ? 'check-circle' : 'ban'"
                >{{ status.data.value?.enabled ? 'مفعّل' : 'بلا مفاتيح VAPID' }}</AppBadge
              >
            </li>
            <li class="flex items-center justify-between gap-3">
              <span>هذا الجهاز</span>
              <AppBadge
                :tone="state === 'on' ? 'success' : state === 'checking' ? 'neutral' : 'warning'"
                :icon="state === 'on' ? 'check-circle' : 'alert'"
                >{{
                  {
                    checking: 'جارٍ الفحص',
                    on: 'مشترك',
                    off: 'غير مفعّل',
                    denied: 'الإذن محظور',
                    'needs-install': 'يلزم التثبيت',
                    unsupported: 'غير مدعوم',
                  }[state]
                }}</AppBadge
              >
            </li>
            <li class="flex items-center justify-between gap-3">
              <span>وضع الفتح</span>
              <span class="font-semibold">{{ standalone ? 'تطبيق مثبّت' : 'تبويب المتصفح' }}</span>
            </li>
          </ul>
        </section>

        <!-- الإجراء -->
        <section class="rounded-3xl bg-surface p-4 shadow-card">
          <AutoHeight>
            <FadeTransition>
              <div v-if="state === 'off'" key="off" class="flex flex-col gap-3">
                <p class="text-[15px]">اضغط «تفعيل» ثم اسمح بالإشعارات حين يسأل الهاتف.</p>
                <AppButton
                  variant="gold"
                  size="lg"
                  icon="check"
                  block
                  :loading="busy"
                  :disabled="!status.data.value?.enabled"
                  @click="enable"
                  >تفعيل الإشعارات</AppButton
                >
              </div>

              <div v-else-if="state === 'on'" key="on" class="flex flex-col gap-3">
                <p class="text-[15px]">
                  اضغط واحداً ثم <strong>اقفل الهاتف</strong>. يظهر على الإشعار «وصل بعد …».
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <AppButton
                    v-for="d in DELAYS"
                    :key="d.seconds"
                    variant="secondary"
                    icon="clock"
                    :loading="sending === d.seconds"
                    :disabled="sending !== null"
                    @click="send(d.seconds)"
                    >{{ d.label }}</AppButton
                  >
                </div>
                <AppButton variant="danger-soft" icon="ban" :loading="busy" @click="disable"
                  >إيقاف على هذا الجهاز</AppButton
                >
              </div>

              <div v-else-if="state === 'denied'" key="denied" class="flex flex-col gap-2">
                <p class="flex items-center gap-2 font-bold text-red-900">
                  <AppIcon name="ban" :size="18" /> الإذن محظور
                </p>
                <p class="text-[15px]">
                  Chrome ← ⋮ ← الإعدادات ← إعدادات الموقع ← الإشعارات ← اسمح لهذا الموقع. أو
                  الإعدادات ← الإشعارات ← Chrome.
                </p>
              </div>

              <div v-else-if="state === 'needs-install'" key="install" class="flex flex-col gap-2">
                <p class="flex items-center gap-2 font-bold">
                  <AppIcon name="info" :size="18" /> iPhone: يلزم التثبيت
                </p>
                <ol class="list-decimal ps-5 text-[15px]">
                  <li>زر المشاركة في Safari.</li>
                  <li>«إضافة إلى الشاشة الرئيسية».</li>
                  <li>افتح Golden Touch من الأيقونة وسجّل الدخول.</li>
                </ol>
              </div>

              <p v-else-if="state === 'unsupported'" key="unsupported" class="text-[15px]">
                هذا المتصفح لا يدعم الإشعارات. جرّب Chrome.
              </p>

              <p v-else key="checking" class="text-[15px]">جارٍ فحص الجهاز…</p>
            </FadeTransition>
          </AutoHeight>
        </section>

        <!-- المجدول وآخر الإرسالات -->
        <ExpandTransition>
          <section v-if="pending.length" class="rounded-3xl bg-surface p-4 shadow-card">
            <h2 class="mb-3 flex items-center gap-2 font-bold">
              <AppIcon name="hourglass" :size="18" /> مجدول
            </h2>
            <ul class="flex flex-col gap-1.5 text-[15px]">
              <li v-for="(p, i) in pending" :key="i" class="flex items-center gap-2">
                <AppIcon name="clock" :size="16" /> بعد {{ inLabel(p.inSeconds) }}
              </li>
            </ul>
          </section>
        </ExpandTransition>

        <ExpandTransition>
          <section v-if="log.length" class="rounded-3xl bg-surface p-4 shadow-card">
            <h2 class="mb-3 flex items-center gap-2 font-bold">
              <AppIcon name="history" :size="18" /> آخر الإرسالات
            </h2>
            <ul class="flex flex-col gap-2 text-[15px]">
              <li
                v-for="(entry, i) in log"
                :key="entry.at + i"
                class="flex items-center justify-between gap-3"
              >
                <span>{{ formatTime(entry.at) }}</span>
                <AppBadge
                  :tone="entry.status === 201 ? 'success' : 'danger'"
                  :icon="entry.status === 201 ? 'check-circle' : 'alert'"
                  >{{
                    entry.status === 201
                      ? 'قبلته خدمة الإشعارات'
                      : entry.removed
                        ? `سقط الاشتراك (${entry.status})`
                        : `فشل (${entry.status})`
                  }}</AppBadge
                >
              </li>
            </ul>
          </section>
        </ExpandTransition>

        <!-- إعداد Poco -->
        <Disclosure>
          <template #summary>
            <AppIcon name="sliders" :size="18" />
            <span class="font-bold">إعداد Poco (مرة واحدة)</span>
          </template>
          <ol class="list-decimal ps-9 pe-4 pb-4 text-[15px] leading-7">
            <li v-for="step in CHECKLIST" :key="step">{{ step }}</li>
          </ol>
        </Disclosure>
      </div>
    </FadeTransition>
  </div>
</template>
