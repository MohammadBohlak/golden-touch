<script setup lang="ts">
import type { Gap } from '~/types/api'

const props = defineProps<{ gap: Gap; timezone: string; minDuration: number; canCreate: boolean }>()
defineEmits<{ create: [startAt: string] }>()

const tooShort = computed(() => props.gap.minutes < props.minDuration)
const bookable = computed(() => props.canCreate && !props.gap.past && !tooShort.value)
const label = computed(() => formatTimeRange(props.gap.start, props.gap.end, props.timezone))
</script>

<template>
  <!-- فراغ مضى: سطر مختصر باهت -->
  <div
    v-if="gap.past"
    class="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-fg-subtle"
  >
    <span class="h-px flex-1 bg-line" aria-hidden="true" />
    <span>فراغ انقضى · {{ label }}</span>
    <span class="h-px flex-1 bg-line" aria-hidden="true" />
  </div>

  <!-- فراغ متاح للحجز -->
  <button
    v-else-if="bookable"
    type="button"
    class="group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-gold-300 bg-gold-50/60 p-3 text-start transition-colors hover:border-gold-500 hover:bg-gold-50 active:scale-[0.99]"
    :aria-label="`وقت متاح ${label}، احجز`"
    @click="$emit('create', gap.start)"
  >
    <div class="flex w-16 shrink-0 flex-col items-center justify-center text-center">
      <span class="text-lg leading-tight font-extrabold text-gold-800 tabular-nums">{{
        formatClock(gap.start, timezone)
      }}</span>
      <span class="text-[11px] font-semibold text-gold-700">{{
        formatMeridiem(gap.start, timezone)
      }}</span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="flex items-center gap-1.5 font-bold text-gold-800">
        <AppIcon name="check-circle" :size="16" />
        متاح
      </span>
      <span class="text-sm text-fg-muted">{{ label }} · {{ formatDuration(gap.minutes) }}</span>
    </div>
    <span
      class="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-ink-950 px-3 text-sm font-bold text-gold-300 transition-colors group-hover:bg-ink-800"
    >
      <AppIcon name="plus" :size="16" :stroke-width="2.5" />
      احجز
    </span>
  </button>

  <!-- فراغ قصير لا يتسع لأي خدمة -->
  <div
    v-else
    class="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-muted/60 px-3 py-2 text-sm text-fg-muted"
  >
    <AppIcon name="hourglass" :size="16" />
    <span
      >{{ tooShort ? 'فراغ قصير' : 'فراغ' }} · {{ label }} ({{ formatDuration(gap.minutes) }})</span
    >
  </div>
</template>
