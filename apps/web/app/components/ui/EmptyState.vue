<script setup lang="ts">
import type { IconName } from '~/utils/icons'

withDefaults(defineProps<{ icon?: IconName; title: string; description?: string }>(), {
  icon: 'sparkle',
  description: undefined,
})
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface/60 px-5 py-10 text-center"
  >
    <span class="grid size-14 place-items-center rounded-2xl bg-gold-50 text-gold-700">
      <AppIcon :name="icon" :size="26" />
    </span>
    <div class="flex flex-col gap-1">
      <p class="font-bold">{{ title }}</p>
      <p v-if="description" class="max-w-xs text-sm text-fg-muted">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
