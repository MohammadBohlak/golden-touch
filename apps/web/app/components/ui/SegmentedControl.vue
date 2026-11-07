<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: { value: T; label: string; count?: number }[]
  label: string
}>()
const model = defineModel<T>({ required: true })

// المؤشر الداكن ينزلق إلى الخيار المحدّد؛ قبل جاهزيته (HTML الخادم) يرسم الخيار خلفيته بنفسه
const track = ref<HTMLElement>()
const indicator = useSlidingIndicator(track, '[aria-checked="true"]', model)
</script>

<template>
  <div
    ref="track"
    role="radiogroup"
    :aria-label="label"
    class="relative no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-surface-muted p-1"
  >
    <!-- left/top: صفر فيزيائياً عمداً — الإزاحة تُقاس من الحافة اليسرى للحاوية في RTL أيضاً -->
    <span
      v-show="indicator.ready.value"
      aria-hidden="true"
      style="left: 0; top: 0"
      :class="
        cn(
          'pointer-events-none absolute z-0 rounded-xl bg-ink-950 shadow-card',
          indicator.motionClass.value,
        )
      "
      :style="indicator.style.value"
    />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :class="
        cn(
          'relative z-10 flex h-10 min-w-fit flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors',
          model === option.value
            ? cn('text-white', !indicator.ready.value && 'bg-ink-950 shadow-card')
            : 'text-fg-muted hover:bg-surface hover:text-fg',
        )
      "
      @click="model = option.value"
    >
      {{ option.label }}
      <span
        v-if="option.count !== undefined"
        :class="
          cn(
            'rounded-full px-1.5 text-xs tabular-nums transition-colors',
            model === option.value ? 'bg-gold-300 text-ink-950' : 'bg-line text-fg-muted',
          )
        "
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>
