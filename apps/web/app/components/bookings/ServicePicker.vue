<script setup lang="ts">
import type { Service } from '~/types/api'

defineProps<{ services: Service[]; invalid?: boolean; describedBy?: string }>()
const model = defineModel<string | null | undefined>()
</script>

<template>
  <div
    role="radiogroup"
    aria-label="الخدمة"
    :aria-describedby="describedBy"
    :aria-invalid="invalid || undefined"
    class="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
  >
    <button
      v-for="service in services"
      :key="service.id"
      type="button"
      role="radio"
      :aria-checked="model === service.id"
      :class="
        cn(
          'relative flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl border-2 p-3 text-start transition-[border-color,background-color,transform] active:scale-[0.98]',
          model === service.id
            ? 'border-ink-950 bg-ink-950 text-white'
            : cn('bg-surface hover:border-gold-400', invalid ? 'border-red-300' : 'border-line'),
        )
      "
      @click="model = service.id"
    >
      <span class="flex w-full items-start justify-between gap-2">
        <span class="text-base leading-snug font-bold">{{ service.name }}</span>
        <span
          v-if="model === service.id"
          class="grid size-6 shrink-0 place-items-center rounded-full bg-gold-300 text-ink-950"
          aria-hidden="true"
        >
          <AppIcon name="check" :size="14" :stroke-width="3" />
        </span>
      </span>
      <span class="flex flex-col gap-0.5 text-sm">
        <span :class="model === service.id ? 'text-ink-300' : 'text-fg-muted'">
          <AppIcon name="clock" :size="13" class="-mt-0.5 inline" />
          {{ formatDuration(service.durationMinutes) }}
        </span>
        <span
          :class="
            cn('font-bold tabular-nums', model === service.id ? 'text-gold-300' : 'text-brand-ink')
          "
        >
          {{ service.price ? formatMoney(service.price) : 'السعر غير محدد' }}
        </span>
      </span>
    </button>
  </div>
</template>
