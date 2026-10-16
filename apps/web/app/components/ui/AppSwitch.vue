<script setup lang="ts">
defineProps<{ label: string; description?: string; disabled?: boolean }>()
const model = defineModel<boolean>({ default: false })
const id = useId()
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <label :for="id" class="flex min-w-0 flex-col">
      <span class="font-semibold">{{ label }}</span>
      <span v-if="description" class="text-sm text-fg-muted">{{ description }}</span>
    </label>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      :class="
        cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50',
          model ? 'bg-ink-950' : 'bg-line-strong',
        )
      "
      @click="model = !model"
    >
      <span
        :class="
          cn(
            'absolute start-1 size-5 rounded-full shadow transition-transform duration-200',
            model ? 'bg-gold-300 ltr:translate-x-5 rtl:-translate-x-5' : 'bg-white',
          )
        "
      />
    </button>
  </div>
</template>
