<script setup lang="ts">
import type { Availability, Slot } from '~/types/api'

/**
 * شبكة أوقات البدء ليوم ومدة معيّنين مع تمييز بصري واضح:
 * متاح (أبيض بإطار) · محجوز (مخطط ومشطوب) · لا يتسع للمدة (باهت بإطار متقطع) · مضى (مخفي افتراضياً)
 */
const props = defineProps<{
  date: string
  durationMinutes: number | null
  excludeId?: string
  timezone: string
  invalid?: boolean
}>()
const model = defineModel<string | null | undefined>()
const emit = defineEmits<{ nextDay: [] }>()

const { $api } = useNuxtApp()
const showPast = ref(false)
const customTime = ref('')

const { data, loading, errorMessage, execute, refresh } = useApiState(
  (signal, date: string, duration: number) =>
    $api<Availability>('/bookings/availability', {
      query: { date, durationMinutes: duration, excludeId: props.excludeId },
      signal,
    }),
)

watch(
  () => [props.date, props.durationMinutes] as const,
  ([date, duration]) => {
    if (date && duration) void execute(date, duration)
  },
  { immediate: true },
)

defineExpose({ refresh })

// إن أصبح الوقت المختار غير متاح (بعد تغيير الخدمة/المدة) نلغي الاختيار
watch(data, (availability) => {
  if (!availability || !model.value) return
  const selected = availability.slots.find((s) => s.start === model.value)
  if (selected && selected.state !== 'available') model.value = null
})

const counts = computed(() => {
  const slots = data.value?.slots ?? []
  return {
    available: slots.filter((s) => s.state === 'available').length,
    past: slots.filter((s) => s.state === 'past').length,
  }
})

const periods = computed(() => {
  const groups: { label: string; slots: Slot[] }[] = [
    { label: 'الصباح', slots: [] },
    { label: 'بعد الظهر', slots: [] },
    { label: 'المساء', slots: [] },
  ]
  for (const slot of data.value?.slots ?? []) {
    if (slot.state === 'past' && !showPast.value) continue
    const hour = Number(timeInTz(slot.start, props.timezone).slice(0, 2))
    const dayOffset = dateInTz(slot.start, props.timezone) > props.date
    groups[dayOffset || hour >= 17 ? 2 : hour >= 12 ? 1 : 0]!.slots.push(slot)
  }
  return groups.filter((g) => g.slots.length)
})

const selectedOutsideGrid = computed(
  () => Boolean(model.value) && !(data.value?.slots ?? []).some((s) => s.start === model.value),
)

const stateLabel: Record<Slot['state'], string> = {
  available: 'متاح',
  booked: 'محجوز',
  conflict: 'لا يتسع للمدة',
  past: 'مضى',
}

function applyCustomTime() {
  if (!customTime.value) return
  model.value = zonedToIso(props.date, customTime.value, props.timezone)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- مفتاح الألوان -->
    <ul
      class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-fg-muted"
      aria-label="دليل الألوان"
    >
      <li class="flex items-center gap-1.5">
        <span class="size-3.5 rounded border border-line-strong bg-surface" /> متاح
      </li>
      <li class="flex items-center gap-1.5"><span class="size-3.5 rounded bg-ink-950" /> مختار</li>
      <li class="flex items-center gap-1.5">
        <span class="size-3.5 rounded bg-surface-muted striped" /> محجوز
      </li>
      <li class="flex items-center gap-1.5">
        <span class="size-3.5 rounded border border-dashed border-line-strong bg-surface-muted" />
        لا يتسع للمدة
      </li>
    </ul>

    <p
      v-if="!durationMinutes"
      class="rounded-2xl bg-surface-muted p-4 text-center text-sm text-fg-muted"
    >
      اختر الخدمة أولاً لعرض الأوقات المتاحة.
    </p>

    <LoadingState v-else-if="loading && !data" variant="spinner" label="جارٍ تحميل الأوقات…" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />

    <template v-else-if="data">
      <div
        v-if="data.closed"
        class="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm font-semibold text-amber-900"
      >
        <AppIcon name="info" :size="18" class="mt-0.5" />
        هذا اليوم عطلة أسبوعية، يمكنك الحجز استثنائياً.
      </div>

      <div
        :class="cn('flex flex-col gap-4 transition-opacity', loading && 'opacity-60')"
        :aria-busy="loading"
      >
        <div v-for="period in periods" :key="period.label">
          <p class="mb-2 text-sm font-bold text-fg-muted">{{ period.label }}</p>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button
              v-for="slot in period.slots"
              :key="slot.start"
              type="button"
              :disabled="slot.state !== 'available'"
              :aria-pressed="model === slot.start"
              :aria-label="`${formatTime(slot.start, timezone)} — ${stateLabel[slot.state]}`"
              :title="stateLabel[slot.state]"
              :class="
                cn(
                  'h-12 rounded-xl text-[15px] font-bold tabular-nums transition-[background-color,border-color,transform]',
                  slot.state === 'available' &&
                    (model === slot.start
                      ? 'bg-ink-950 text-gold-300 shadow-card'
                      : cn(
                          'border bg-surface text-fg hover:border-gold-500 active:scale-95',
                          invalid ? 'border-red-300' : 'border-line-strong',
                        )),
                  slot.state === 'booked' &&
                    'cursor-not-allowed bg-surface-muted striped text-fg-subtle line-through',
                  slot.state === 'conflict' &&
                    'cursor-not-allowed border border-dashed border-line-strong bg-surface-muted/70 text-fg-subtle',
                  slot.state === 'past' && 'cursor-not-allowed text-fg-subtle/70',
                )
              "
              @click="model = slot.start"
            >
              {{ formatClock(slot.start, timezone) }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="counts.available === 0"
        class="flex flex-col items-center gap-2 rounded-2xl bg-surface-muted p-4 text-center"
      >
        <p class="text-sm font-semibold">لا توجد أوقات متاحة لهذه المدة في هذا اليوم.</p>
        <AppButton variant="secondary" size="sm" icon-end="chevron-right" @click="emit('nextDay')">
          اليوم التالي
        </AppButton>
      </div>

      <button
        v-if="counts.past"
        type="button"
        class="self-start text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
        @click="showPast = !showPast"
      >
        {{ showPast ? 'إخفاء الأوقات الماضية' : `إظهار الأوقات الماضية (${counts.past})` }}
      </button>

      <details class="group rounded-2xl border border-line bg-surface" :open="selectedOutsideGrid">
        <summary
          class="flex h-12 list-none items-center justify-between px-4 text-sm font-semibold"
        >
          <span class="flex items-center gap-2">
            <AppIcon name="clock" :size="16" />
            وقت مخصص (خارج الشبكة أو بعد الدوام)
          </span>
          <AppIcon
            name="chevron-down"
            :size="18"
            class="transition-transform group-open:rotate-180"
          />
        </summary>
        <div class="flex items-end gap-2 px-4 pb-4">
          <div class="flex-1">
            <label for="custom-time" class="sr-only">الوقت</label>
            <AppInput id="custom-time" v-model="customTime" type="time" dir="ltr" />
          </div>
          <AppButton variant="secondary" :disabled="!customTime" @click="applyCustomTime"
            >اعتماد</AppButton
          >
        </div>
        <p
          v-if="selectedOutsideGrid && model"
          class="px-4 pb-4 text-sm font-semibold text-brand-ink"
        >
          الوقت المختار: {{ formatTime(model, timezone) }} — سيتحقق النظام من عدم التداخل عند الحفظ.
        </p>
      </details>
    </template>
  </div>
</template>
