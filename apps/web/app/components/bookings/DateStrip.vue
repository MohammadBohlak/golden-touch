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

// اتجاه انزلاق الأسبوع: الأحدث يدخل من جهة النهاية
const weekTransition = ref<'day-next' | 'day-prev'>('day-next')
watch(anchor, (next, prev) => {
  weekTransition.value = next > prev ? 'day-next' : 'day-prev'
})

// مؤشر اليوم المحدّد ينزلق بين الأيام؛ عند تبدّل الأسبوع يُعاد قياسه بعد دخول الشبكة الجديدة
const track = ref<HTMLElement>()
const indicator = useSlidingIndicator(track, '[aria-selected="true"]', model)

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

const selectedInWeek = computed(() => days.value.some((d) => d.date === model.value))
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
      <div class="flex-1 text-center text-sm font-bold" aria-live="polite">
        <Transition name="fade" mode="out-in">
          <p :key="monthLabel">{{ monthLabel }}</p>
        </Transition>
      </div>
      <AppButton
        variant="ghost"
        size="icon-sm"
        icon="chevron-right"
        aria-label="الأسبوع التالي"
        @click="anchor = addDays(anchor, 7)"
      />
      <Collapse axis="x" :open="model !== today" inner-class="-m-1 p-1">
        <AppButton variant="secondary" size="sm" class="ms-1" @click="model = today">
          اليوم
        </AppButton>
      </Collapse>
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

    <div ref="track" class="relative">
      <!-- left/top: صفر فيزيائياً عمداً — الإزاحة تُقاس من الحافة اليسرى للحاوية في RTL أيضاً -->
      <span
        v-show="indicator.ready.value"
        aria-hidden="true"
        style="left: 0; top: 0"
        :class="
          cn(
            'pointer-events-none absolute z-0 rounded-2xl bg-ink-950 shadow-card',
            indicator.motionClass.value,
          )
        "
        :style="{ ...indicator.style.value, ...(selectedInWeek ? {} : { opacity: 0 }) }"
      />
      <Transition :name="weekTransition" mode="out-in" @after-enter="indicator.measure">
        <div
          :key="anchor"
          class="relative z-10 grid grid-cols-7 gap-1"
          role="listbox"
          aria-label="أيام الأسبوع"
        >
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
                  ? cn('text-white', !indicator.ready.value && 'bg-ink-950 shadow-card')
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
                cn(
                  'absolute bottom-1.5 size-1 rounded-full',
                  d.isOff ? 'bg-red-400' : 'bg-gold-500',
                )
              "
              aria-hidden="true"
            />
          </button>
        </div>
      </Transition>
    </div>
  </section>
</template>
