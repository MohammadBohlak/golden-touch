<script setup lang="ts">
import type { IconName } from '~/utils/icons'

export type BadgeTone = 'neutral' | 'gold' | 'success' | 'danger' | 'warning' | 'info' | 'dark'

withDefaults(defineProps<{ tone?: BadgeTone; icon?: IconName }>(), {
  tone: 'neutral',
  icon: undefined,
})

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-fg-muted ring-line',
  gold: 'bg-gold-50 text-gold-800 ring-gold-200',
  success: 'bg-success-soft text-green-800 ring-green-200',
  danger: 'bg-danger-soft text-red-800 ring-red-200',
  warning: 'bg-warning-soft text-amber-900 ring-amber-200',
  info: 'bg-info-soft text-blue-800 ring-blue-200',
  dark: 'bg-ink-950 text-gold-300 ring-ink-950',
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-bold whitespace-nowrap ring-1 ring-inset',
        tones[tone],
      )
    "
  >
    <AppIcon v-if="icon" :name="icon" :size="12" :stroke-width="2.5" />
    <slot />
  </span>
</template>
