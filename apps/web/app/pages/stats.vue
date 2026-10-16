<script setup lang="ts">
import type { BarPoint } from '~/types/ui'
import type { StatsSummary } from '~/types/api'

definePageMeta({ title: 'الإحصائيات', permission: 'stats.read' })

const { $api } = useNuxtApp()
const { today } = useShopTime()

type Period = 'week' | 'month' | 'custom'
const period = ref<Period>('week')
const anchor = ref(today.value)
const customFrom = ref(addDays(today.value, -29))
const customTo = ref(today.value)

const periods = [
  { value: 'week' as const, label: 'أسبوعي' },
  { value: 'month' as const, label: 'شهري' },
  { value: 'custom' as const, label: 'فترة مخصصة' },
]

watch(period, () => (anchor.value = today.value))

const range = computed(() => {
  if (period.value === 'week') {
    const from = startOfWeek(anchor.value)
    return { from, to: addDays(from, 6) }
  }
  if (period.value === 'month')
    return { from: startOfMonth(anchor.value), to: endOfMonth(anchor.value) }
  return customFrom.value <= customTo.value
    ? { from: customFrom.value, to: customTo.value }
    : { from: customTo.value, to: customFrom.value }
})

const rangeLabel = computed(() => {
  const { from, to } = range.value
  if (period.value === 'month') return formatMonth(from)
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${formatDateShort(from, !sameYear)} – ${formatDateShort(to, true)}`
})

const isCurrent = computed(() => range.value.from <= today.value && today.value <= range.value.to)

function shift(direction: 1 | -1) {
  anchor.value =
    period.value === 'week'
      ? addDays(anchor.value, 7 * direction)
      : addMonths(anchor.value, direction)
}

const { data, loading, errorMessage, execute, refresh } = useApiState(
  (signal, from: string, to: string) =>
    $api<StatsSummary>('/stats', { query: { from, to }, signal }),
  { cacheKey: (from, to) => `stats:${from}:${to}`, ttl: 60_000 },
)
watch(range, (r) => execute(r.from, r.to), { immediate: false })
onMounted(() => execute(range.value.from, range.value.to))

const t = computed(() => data.value?.totals)
const p = computed(() => data.value?.previous)

const seriesPoints = computed<BarPoint[]>(() => {
  const series = data.value?.series
  if (!series) return []
  return series.points.map((point) => ({
    key: point.key,
    value: point.revenue,
    label:
      series.granularity === 'day'
        ? formatDateLong(point.key)
        : series.granularity === 'week'
          ? `أسبوع ${formatDateShort(point.key)}`
          : formatMonth(point.key),
    short:
      series.granularity === 'day'
        ? period.value === 'week'
          ? WEEKDAY_SHORT[weekdayOf(point.key)]!
          : String(dayOfMonth(point.key))
        : series.granularity === 'week'
          ? formatDateShort(point.key)
          : formatMonth(point.key).split(' ')[0]!,
  }))
})

const hourPoints = computed<BarPoint[]>(() => {
  const hours = data.value?.byHour ?? []
  const active = hours.map((v, h) => (v ? h : -1)).filter((h) => h >= 0)
  if (!active.length) return []
  const first = Math.min(...active)
  const last = Math.max(...active)
  return hours.slice(first, last + 1).map((value, i) => {
    const hour = first + i
    const label = `${hour % 12 || 12} ${hour < 12 ? 'ص' : 'م'}`
    return { key: String(hour), value, label: `الساعة ${label}`, short: String(hour % 12 || 12) }
  })
})

const busiestDay = computed(() => {
  const days = data.value?.byWeekday ?? []
  const max = Math.max(0, ...days)
  return max ? WEEKDAY_NAMES[days.indexOf(max)] : null
})

const maxServiceCount = computed(() =>
  Math.max(1, ...(data.value?.topServices.map((s) => s.count) ?? [])),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="الإحصائيات" subtitle="أداء الصالون مقارنةً بالفترة السابقة" />

    <SegmentedControl v-model="period" :options="periods" label="نوع الفترة" />

    <div
      v-if="period !== 'custom'"
      class="flex items-center gap-2 rounded-2xl bg-surface p-2 shadow-card"
    >
      <AppButton
        variant="ghost"
        size="icon"
        icon="chevron-left"
        aria-label="الفترة السابقة"
        @click="shift(-1)"
      />
      <p class="flex-1 text-center font-bold tabular-nums" aria-live="polite">{{ rangeLabel }}</p>
      <AppButton
        variant="ghost"
        size="icon"
        icon="chevron-right"
        aria-label="الفترة التالية"
        :disabled="isCurrent"
        @click="shift(1)"
      />
    </div>
    <div v-else class="grid grid-cols-2 gap-3 rounded-2xl bg-surface p-3 shadow-card">
      <div class="flex flex-col gap-1.5">
        <label for="stats-from" class="text-sm font-semibold">من تاريخ</label>
        <AppInput id="stats-from" v-model="customFrom" type="date" :max="today" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="stats-to" class="text-sm font-semibold">إلى تاريخ</label>
        <AppInput id="stats-to" v-model="customTo" type="date" />
      </div>
    </div>

    <LoadingState v-if="loading && !data" variant="cards" :rows="6" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />

    <div
      v-else-if="data && t && p"
      :class="cn('flex flex-col gap-4 transition-opacity', loading && 'opacity-60')"
    >
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          featured
          class="col-span-2 lg:col-span-1"
          label="ميزانية الدخل"
          icon="wallet"
          :value="formatMoney(t.revenue)"
          :delta="percentChange(t.revenue, p.revenue)"
          :hint="`السابقة: ${formatMoney(p.revenue)}`"
        />
        <StatCard
          label="عدد الزبائن"
          icon="users"
          :value="formatNumber(t.customers)"
          :delta="percentChange(t.customers, p.customers)"
          hint="زبائن مختلفون"
        />
        <StatCard
          label="الحجوزات المكتملة"
          icon="check-circle"
          :value="formatNumber(t.completed)"
          :delta="percentChange(t.completed, p.completed)"
        />
        <StatCard
          label="ساعات العمل"
          icon="clock"
          :value="formatHours(t.workMinutes)"
          :delta="percentChange(t.workMinutes, p.workMinutes)"
          hint="مدة الحجوزات المكتملة"
        />
        <StatCard
          label="متوسط الفاتورة"
          icon="trending"
          :value="formatMoney(t.avgTicket)"
          :delta="percentChange(t.avgTicket, p.avgTicket)"
        />
        <StatCard
          label="نسبة الإلغاء"
          icon="ban"
          :value="`${formatNumber(t.cancellationRate)}%`"
          :hint="`${t.cancelled} ملغي · ${t.active} قيد العمل`"
          :delta="percentChange(t.cancellationRate, p.cancellationRate)"
          inverse
        />
      </div>

      <section class="rounded-3xl bg-surface p-4 shadow-card">
        <BarChart :points="seriesPoints" title="الدخل" :format="formatMoney" />
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-3xl bg-surface p-4 shadow-card" aria-labelledby="top-customers">
          <h2 id="top-customers" class="mb-3 flex items-center gap-2 font-bold">
            <AppIcon name="crown" :size="18" class="text-gold-600" />
            أكثر ثلاثة زبائن
          </h2>
          <p v-if="!data.topCustomers.length" class="py-6 text-center text-sm text-fg-muted">
            لا توجد زيارات مكتملة بعد.
          </p>
          <ol v-else class="flex flex-col gap-2">
            <li v-for="(entry, i) in data.topCustomers" :key="entry.customerId">
              <NuxtLink
                :to="`/customers/${entry.customerId}`"
                class="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-muted"
              >
                <span
                  :class="
                    cn(
                      'grid size-10 shrink-0 place-items-center rounded-full text-sm font-extrabold',
                      i === 0
                        ? 'bg-gold-300 text-ink-950'
                        : i === 1
                          ? 'bg-ink-200 text-ink-900'
                          : 'bg-gold-100 text-gold-900',
                    )
                  "
                >
                  {{ i + 1 }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-bold">{{
                    entry.customer?.name ?? 'زبون محذوف'
                  }}</span>
                  <span class="block text-sm text-fg-muted">{{ entry.visits }} زيارة</span>
                </span>
                <span class="font-bold text-brand-ink tabular-nums">{{
                  formatMoney(entry.spent)
                }}</span>
              </NuxtLink>
            </li>
          </ol>
        </section>

        <section class="rounded-3xl bg-surface p-4 shadow-card" aria-labelledby="top-services">
          <h2 id="top-services" class="mb-3 flex items-center gap-2 font-bold">
            <AppIcon name="scissors" :size="18" class="text-gold-600" />
            الخدمات الأكثر طلباً
          </h2>
          <p v-if="!data.topServices.length" class="py-6 text-center text-sm text-fg-muted">
            لا توجد بيانات بعد.
          </p>
          <ul v-else class="flex flex-col gap-3">
            <li v-for="service in data.topServices" :key="service.serviceId">
              <div class="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span class="font-bold">{{ service.name }}</span>
                <span class="text-fg-muted tabular-nums"
                  >{{ service.count }} مرة · {{ formatMoneyCompact(service.revenue) }}</span
                >
              </div>
              <div class="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  class="h-full rounded-full bg-gold-400"
                  :style="{ width: `${(service.count / maxServiceCount) * 100}%` }"
                />
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section class="rounded-3xl bg-surface p-4 shadow-card">
        <BarChart
          :points="hourPoints"
          title="أوقات الذروة (عدد الزبائن حسب الساعة)"
          :height="110"
        />
        <p v-if="busiestDay" class="mt-3 text-sm text-fg-muted">
          أكثر الأيام ازدحاماً: <strong class="text-fg">{{ busiestDay }}</strong>
        </p>
      </section>
    </div>
  </div>
</template>
