<script setup lang="ts">
/**
 * شريط أسبوع (سبت → جمعة) لاختيار اليوم: 7 أيام بعرض متساوٍ بلا تمرير أفقي،
 * مع أسهم للأسبوع السابق/التالي، زر "اليوم"، ومنتقي تاريخ أصلي للقفز لأي تاريخ.
 */
const props = defineProps<{ today: string; daysOff?: number[] }>()
const model = defineModel<string>({ required: true })

const anchor = ref(startOfWeek(model.value))
watch(model, (value) => {
  if (value < anchor.value || value > addDays(anchor.value, 6)) anchor.value = startOfWeek(value)
})

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = addDays(anchor.value, i)
    return {
      date,
      weekday: WEEKDAY_SHORT[weekdayOf(date)],
      day: dayOfMonth(date),
      isToday: date === props.today,
      isOff: props.daysOff?.includes(weekdayOf(date)) ?? false,
      isPast: date < props.today,
    }
  }),
)

const monthLabel = computed(() => formatMonth(model.value))
const picker = ref<HTMLInputElement>()

function openPicker() {
  const input = picker.value
  if (!input) return
  if (typeof input.showPicker === 'function') input.showPicker()
  else input.click()
}

function onPick(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value) model.value = value
}
</script>

<template>
  <section aria-label="اختيار اليوم" class="rounded-3xl bg-surface p-3 shadow-card">
    <div class="mb-2 flex items-center gap-1">
      <AppButton
        variant="ghost"
        size="icon-sm"
        icon="chevron-left"
        aria-label="الأسبوع السابق"
        @click="anchor = addDays(anchor, -7)"
      />
      <p class="flex-1 text-center text-sm font-bold" aria-live="polite">{{ monthLabel }}</p>
      <AppButton
        variant="ghost"
        size="icon-sm"
        icon="chevron-right"
        aria-label="الأسبوع التالي"
        @click="anchor = addDays(anchor, 7)"
      />
      <AppButton
        v-if="model !== today"
        variant="secondary"
        size="sm"
        class="ms-1"
        @click="model = today"
      >
        اليوم
      </AppButton>
      <div class="relative">
        <AppButton
          variant="secondary"
          size="icon-sm"
          icon="calendar"
          aria-label="اختيار تاريخ"
          @click="openPicker"
        />
        <input
          ref="picker"
          type="date"
          :value="model"
          tabindex="-1"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-0"
          @change="onPick"
        />
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1" role="listbox" aria-label="أيام الأسبوع">
      <button
        v-for="d in days"
        :key="d.date"
        type="button"
        role="option"
        :aria-selected="d.date === model"
        :aria-label="`${formatDateLong(d.date)}${d.isToday ? ' — اليوم' : ''}${d.isOff ? ' — عطلة' : ''}`"
        :class="
          cn(
            'relative flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors',
            d.date === model
              ? 'bg-ink-950 text-white shadow-card'
              : d.isToday
                ? 'bg-gold-50 text-fg ring-1 ring-gold-300 ring-inset'
                : 'text-fg hover:bg-surface-muted',
            d.isPast && d.date !== model && 'text-fg-subtle',
          )
        "
        @click="model = d.date"
      >
        <span
          :class="
            cn('text-[11px] font-semibold', d.date === model ? 'text-ink-300' : 'text-fg-muted')
          "
        >
          {{ d.weekday }}
        </span>
        <span
          :class="
            cn(
              'text-lg leading-none font-extrabold tabular-nums',
              d.date === model && 'text-gold-300',
            )
          "
        >
          {{ d.day }}
        </span>
        <span
          v-if="d.isToday || d.isOff"
          :class="
            cn('absolute bottom-1.5 size-1 rounded-full', d.isOff ? 'bg-red-400' : 'bg-gold-500')
          "
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>
