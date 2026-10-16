<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: { value: T; label: string; count?: number }[]
  label: string
}>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-surface-muted p-1"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :class="
        cn(
          'flex h-10 min-w-fit flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors',
          model === option.value
            ? 'bg-ink-950 text-white shadow-card'
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
            'rounded-full px-1.5 text-xs tabular-nums',
            model === option.value ? 'bg-gold-300 text-ink-950' : 'bg-line text-fg-muted',
          )
        "
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>
