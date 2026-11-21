<script setup lang="ts">
/**
 * قسم «الإشعارات على هذا الجهاز» في صفحة الحساب (docs/PUSH_NOTIFICATIONS_PLAN.md §5.4).
 * الحالات: needs-install (iPhone) · unsupported · denied · off · on · server-off.
 */
const { state, platform, busy, init, loadKey, enable, disable, test } = usePush()

const STATUS: Record<
  typeof state.value,
  {
    label: string
    tone: 'success' | 'neutral' | 'warning' | 'danger'
    icon: 'check-circle' | 'alert' | 'ban' | 'clock'
  }
> = {
  checking: { label: 'جارٍ الفحص', tone: 'neutral', icon: 'clock' },
  on: { label: 'مفعّلة', tone: 'success', icon: 'check-circle' },
  off: { label: 'غير مفعّلة', tone: 'warning', icon: 'alert' },
  denied: { label: 'محظورة', tone: 'danger', icon: 'ban' },
  'needs-install': { label: 'يلزم التثبيت', tone: 'warning', icon: 'alert' },
  unsupported: { label: 'غير مدعومة', tone: 'danger', icon: 'ban' },
  'server-off': { label: 'غير متاحة', tone: 'danger', icon: 'ban' },
}

/** نصائح لمرة واحدة تضمن وصول الإشعار: أجهزة Xiaomi/Poco تقتل التطبيقات الخلفية بشدة */
const ANDROID_TIPS = [
  'البطارية: Chrome ← «بلا قيود».',
  '«التشغيل التلقائي» لـ Chrome مفعّل.',
  'إشعارات Chrome: الأهمية «عالية» والصوت مفعّل.',
  'قفل Chrome في قائمة التطبيقات الأخيرة.',
  'الهاتف ليس على الصامت ولا «عدم الإزعاج».',
]

onMounted(async () => {
  await init()
  // مفتاح VAPID قبل النقرة (شرط iPhone) ولكشف «الخادم غير مفعّل» مبكراً
  if (state.value === 'off') await loadKey()
})
</script>

<template>
  <section class="rounded-3xl bg-surface p-4 shadow-card" aria-labelledby="push-title">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 id="push-title" class="flex items-center gap-2 font-bold">
        <AppIcon name="bell" :size="18" /> الإشعارات على هذا الجهاز
      </h2>
      <AppBadge :tone="STATUS[state].tone" :icon="STATUS[state].icon">{{
        STATUS[state].label
      }}</AppBadge>
    </div>

    <AutoHeight>
      <FadeTransition>
        <div v-if="state === 'off'" key="off" class="flex flex-col gap-3">
          <p class="text-[15px]">إشعار قبل كل موعد بـ 15 دقيقة: الاسم · الخدمة · الوقت.</p>
          <AppButton variant="gold" size="lg" icon="bell" block :loading="busy" @click="enable"
            >تفعيل الإشعارات</AppButton
          >
        </div>

        <div v-else-if="state === 'on'" key="on" class="flex flex-col gap-3">
          <p class="text-[15px]">يصلك إشعار قبل كل موعد بـ 15 دقيقة.</p>
          <div class="grid grid-cols-2 gap-2">
            <AppButton variant="secondary" icon="message" :loading="busy" @click="test"
              >إشعار تجريبي</AppButton
            >
            <AppButton variant="danger-soft" icon="ban" :loading="busy" @click="disable"
              >إيقاف</AppButton
            >
          </div>
          <Disclosure v-if="platform === 'android'">
            <template #summary>
              <AppIcon name="sliders" :size="18" />
              <span class="font-bold">لضمان وصول الإشعار</span>
            </template>
            <ol class="list-decimal ps-9 pe-4 pb-4 text-[15px] leading-7">
              <li v-for="tip in ANDROID_TIPS" :key="tip">{{ tip }}</li>
            </ol>
          </Disclosure>
          <p v-else-if="platform === 'ios'" class="text-[15px]">
            إن كنت تستعمل «وضع التركيز» فاسمح لـ Golden Touch فيه.
          </p>
        </div>

        <div v-else-if="state === 'denied'" key="denied" class="flex flex-col gap-2">
          <p class="text-[15px] font-semibold">الإذن محظور. لفك الحظر:</p>
          <p v-if="platform === 'ios'" class="text-[15px]">
            الإعدادات ← الإشعارات ← Golden Touch ← السماح.
          </p>
          <p v-else class="text-[15px]">
            Chrome ← ⋮ ← الإعدادات ← إعدادات الموقع ← الإشعارات ← اسمح لهذا الموقع.
          </p>
        </div>

        <div v-else-if="state === 'needs-install'" key="install" class="flex flex-col gap-2">
          <p class="text-[15px] font-semibold">
            على iPhone تعمل الإشعارات بعد إضافة الموقع للشاشة الرئيسية:
          </p>
          <ol class="list-decimal ps-5 text-[15px] leading-7">
            <li>زر المشاركة في Safari.</li>
            <li>«إضافة إلى الشاشة الرئيسية».</li>
            <li>افتح Golden Touch من الأيقونة وسجّل الدخول.</li>
          </ol>
        </div>

        <p v-else-if="state === 'unsupported'" key="unsupported" class="text-[15px]">
          هذا المتصفح لا يدعم الإشعارات. استعمل Chrome.
        </p>

        <p v-else-if="state === 'server-off'" key="server-off" class="text-[15px]">
          الإشعارات غير مفعّلة على الخادم. راجع المدير.
        </p>

        <p v-else key="checking" class="text-[15px]" role="status">جارٍ فحص الجهاز…</p>
      </FadeTransition>
    </AutoHeight>
  </section>
</template>
