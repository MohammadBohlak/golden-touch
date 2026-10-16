<script setup lang="ts">
import type { IconName } from '~/utils/icons'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    icon: IconName
    /** نسبة التغيّر عن الفترة السابقة */
    delta?: number | null
    /** الارتفاع سيئ (مثل نسبة الإلغاء) */
    inverse?: boolean
    hint?: string
    featured?: boolean
  }>(),
  { delta: undefined, hint: undefined },
)

const trend = computed(() => {
  if (props.delta === undefined) return null
  if (props.delta === null) return { label: 'جديد', tone: 'neutral' as const }
  if (props.delta === 0) return { label: 'بلا تغيير', tone: 'neutral' as const }
  const up = props.delta > 0
  const good = props.inverse ? !up : up
  return {
    label: `${up ? '▲' : '▼'} ${Math.abs(props.delta)}%`,
    tone: good ? ('good' as const) : ('bad' as const),
  }
})
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col gap-2 rounded-2xl p-4 shadow-card',
        featured ? 'bg-ink-950 text-white' : 'bg-surface',
      )
    "
  >
    <div class="flex items-center justify-between gap-2">
      <span :class="cn('text-sm font-semibold', featured ? 'text-ink-300' : 'text-fg-muted')">{{
        label
      }}</span>
      <span
        :class="
          cn(
            'grid size-8 place-items-center rounded-lg',
            featured ? 'bg-white/10 text-gold-300' : 'bg-gold-50 text-gold-700',
          )
        "
      >
        <AppIcon :name="icon" :size="16" />
      </span>
    </div>
    <p
      :class="cn('text-2xl leading-tight font-extrabold tabular-nums', featured && 'text-gold-300')"
    >
      {{ value }}
    </p>
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        v-if="trend"
        :class="
          cn(
            'rounded-full px-2 py-0.5 font-bold tabular-nums',
            trend.tone === 'good' &&
              (featured ? 'bg-green-500/20 text-green-300' : 'bg-success-soft text-green-800'),
            trend.tone === 'bad' &&
              (featured ? 'bg-red-500/20 text-red-300' : 'bg-danger-soft text-red-800'),
            trend.tone === 'neutral' &&
              (featured ? 'bg-white/10 text-ink-300' : 'bg-surface-muted text-fg-muted'),
          )
        "
      >
        {{ trend.label }}
      </span>
      <span v-if="hint" :class="featured ? 'text-ink-400' : 'text-fg-subtle'">{{ hint }}</span>
    </div>
  </div>
</template>
