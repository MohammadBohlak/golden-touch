<script setup lang="ts">
import type { Booking, DaySchedule } from '~/types/api'

definePageMeta({ title: 'الجدول', permission: 'bookings.read' })

const route = useRoute()
const router = useRouter()
const { $api } = useNuxtApp()
const { timezone, today } = useShopTime()
const { can, isAdmin } = useAuth()
const settings = useSettingsStore()
const servicesStore = useServicesStore()

// التاريخ في الرابط (?date=) حتى يعمل الرجوع والمشاركة
const date = computed({
  get: () => {
    const q = route.query.date
    return typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today.value
  },
  set: (value: string) => {
    router.replace({ query: value === today.value ? {} : { ...route.query, date: value } })
  },
})

const day = useApiState((signal, d: string) =>
  $api<DaySchedule>('/bookings/day', { query: { date: d }, signal }),
)
const overdue = useApiState((signal) => $api<Booking[]>('/bookings/overdue', { signal }))

function load() {
  void day.execute(date.value)
  if (can('bookings.read')) void overdue.execute()
}

onMounted(() => {
  load()
  servicesStore.ensure().catch(() => {})
})
watch(date, () => day.execute(date.value))

// تحديث تلقائي كل دقيقة أثناء ظهور الصفحة (مؤشر "الآن" + تغييرات الزملاء)
let timer: ReturnType<typeof setInterval> | undefined
function onVisibility() {
  if (document.visibilityState === 'visible') load()
}
onMounted(() => {
  timer = setInterval(() => document.visibilityState === 'visible' && load(), 60_000)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})

const sheetOpen = ref(false)
const active = ref<Booking | null>(null)
function openBooking(booking: Booking) {
  active.value = booking
  sheetOpen.value = true
}
function onChanged() {
  invalidateApiCache('stats')
  load()
}

function createAt(startAt?: string) {
  void navigateTo({
    path: '/bookings/new',
    query: startAt ? { start: startAt } : { date: date.value },
  })
}

const headline = computed(() => relativeDayLabel(date.value, today.value))
const subline = computed(() =>
  headline.value === formatDateLong(date.value) ? '' : formatDateLong(date.value),
)
const summary = computed(() => day.data.value?.summary)
const unpriced = computed(() => (isAdmin.value ? servicesStore.unpriced : []))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-brand-ink">
          {{ settings.settings?.shopName ?? 'Golden Touch' }}
        </p>
        <h1 class="text-2xl font-extrabold lg:text-3xl">{{ headline }}</h1>
        <p v-if="subline" class="text-[15px] text-fg-muted">{{ subline }}</p>
      </div>
      <AppButton
        v-if="can('bookings.create')"
        variant="gold"
        icon="plus"
        class="hidden lg:inline-flex"
        @click="createAt()"
      >
        حجز جديد
      </AppButton>
    </div>

    <NuxtLink
      v-if="unpriced.length"
      to="/services"
      class="flex items-center gap-3 rounded-2xl border border-gold-200 bg-gold-50 p-3 text-sm font-semibold text-gold-900 hover:bg-gold-100"
    >
      <AppIcon name="wallet" class="text-gold-700" />
      <span class="flex-1"
        >حدّد أسعار الخدمات ({{ unpriced.map((s) => s.name).join('، ') }}) لتظهر تلقائياً عند
        الإكمال.</span
      >
      <AppIcon name="chevron-right" :size="16" />
    </NuxtLink>

    <DateStrip v-model="date" :today="today" :days-off="settings.settings?.daysOff" />

    <OverdueBanner :bookings="overdue.data.value ?? []" :timezone="timezone" @open="openBooking" />

    <!-- ملخص اليوم -->
    <dl v-if="summary" class="grid grid-cols-4 gap-2">
      <div class="rounded-2xl bg-surface p-2.5 text-center shadow-card">
        <dt class="text-[11px] font-semibold text-fg-muted">الحجوزات</dt>
        <dd class="text-xl font-extrabold tabular-nums">{{ summary.total }}</dd>
      </div>
      <div class="rounded-2xl bg-surface p-2.5 text-center shadow-card">
        <dt class="text-[11px] font-semibold text-fg-muted">قيد العمل</dt>
        <dd class="text-xl font-extrabold text-brand-ink tabular-nums">{{ summary.active }}</dd>
      </div>
      <div class="rounded-2xl bg-surface p-2.5 text-center shadow-card">
        <dt class="text-[11px] font-semibold text-fg-muted">مكتملة</dt>
        <dd class="text-xl font-extrabold text-success tabular-nums">{{ summary.completed }}</dd>
      </div>
      <div class="rounded-2xl bg-ink-950 p-2.5 text-center text-white shadow-card">
        <dt class="text-[11px] font-semibold text-ink-300">الدخل</dt>
        <dd class="text-base leading-7 font-extrabold text-gold-300 tabular-nums">
          {{ formatMoneyCompact(summary.revenue) }}
        </dd>
      </div>
    </dl>

    <LoadingState v-if="day.loading.value && !day.data.value" :rows="5" />
    <ErrorState
      v-else-if="day.errorMessage.value"
      :message="day.errorMessage.value"
      @retry="day.refresh()"
    />
    <DayAgenda
      v-else-if="day.data.value"
      :day="day.data.value"
      :min-duration="servicesStore.minDuration"
      :can-create="can('bookings.create')"
      :class="day.loading.value && 'opacity-70 transition-opacity'"
      @open="openBooking"
      @create="createAt"
    />

    <BookingSheet
      v-model:open="sheetOpen"
      :booking="active"
      :timezone="timezone"
      @changed="onChanged"
      @deleted="onChanged"
    />
  </div>
</template>
