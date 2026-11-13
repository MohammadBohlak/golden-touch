<script setup lang="ts">
import type { RecurringSeries } from '~/types/api'

/**
 * بطاقة حجز دوري: الزبون، التكرار والوقت، الخدمات، الموعد القادم، وما تعذّر إنشاؤه.
 * المعلومة لا تُنقل باللون وحده: الحالة والمشكلات بأيقونة ونص.
 */
const props = defineProps<{
  series: RecurringSeries
  timezone: string
  today: string
  /** يجعل البطاقة رابطاً (القائمة)؛ بدونه عنصر ثابت (التفاصيل) */
  to?: string
}>()
const NuxtLink = resolveComponent('NuxtLink')

const active = computed(() => props.series.status === 'ACTIVE')
const names = computed(() => props.series.services.map((s) => s.name))
</script>

<template>
  <component
    :is="to ? NuxtLink : 'article'"
    :to="to"
    :aria-label="
      to
        ? `${series.customer.name}، ${describeRecurrence(series.weekday, series.intervalWeeks)}`
        : undefined
    "
    :class="
      cn(
        'flex flex-col gap-2.5 rounded-2xl border border-s-4 border-line bg-surface p-3.5 text-start shadow-card',
        active ? 'border-s-gold-400' : 'border-s-line-strong',
        to && 'transition-[box-shadow,transform] hover:shadow-float active:scale-[0.99]',
      )
    "
  >
    <header class="flex items-center gap-2">
      <h2 class="min-w-0 flex-1 truncate text-lg font-bold">{{ series.customer.name }}</h2>
      <AppBadge v-if="!active" tone="neutral" :icon="series.status === 'STOPPED' ? 'ban' : 'clock'">
        {{ STATUS_LABELS[series.status] }}
      </AppBadge>
    </header>

    <p class="flex items-center gap-2 text-[15px] font-semibold">
      <AppIcon name="repeat" :size="18" class="shrink-0 text-gold-800" />
      <span>
        {{ describeRecurrence(series.weekday, series.intervalWeeks) }} ·
        {{ formatClockTime(series.startTime) }}
      </span>
    </p>

    <p class="flex items-center gap-2 text-sm text-fg-muted">
      <AppIcon name="scissors" :size="16" class="shrink-0" />
      <span class="min-w-0">{{ describeServices(names) }}</span>
    </p>

    <p v-if="active" class="flex items-center gap-2 text-sm text-fg-muted">
      <AppIcon name="calendar" :size="16" class="shrink-0" />
      <span v-if="series.next">
        القادم: <strong class="text-fg">{{ nextLabel(series.next, today, timezone) }}</strong>
      </span>
      <span v-else>لا يوجد موعد قادم</span>
    </p>

    <p v-if="series.endDate" class="flex items-center gap-2 text-sm text-fg-muted">
      <AppIcon name="hourglass" :size="16" class="shrink-0" />
      <span>ينتهي {{ formatDateShort(series.endDate, true) }}</span>
    </p>

    <div
      v-if="active && series.issues.length"
      role="status"
      class="flex flex-col gap-1.5 rounded-xl bg-warning-soft p-3 text-amber-900"
    >
      <p class="flex items-center gap-2 text-sm font-bold">
        <AppIcon name="alert" :size="16" class="shrink-0" />
        {{ issuesTitle(series.issues.length) }}
      </p>
      <ul class="flex flex-col gap-0.5 ps-6 text-sm">
        <li v-for="issue in series.issues" :key="issue.date">{{ issueLine(issue) }}</li>
      </ul>
    </div>
  </component>
</template>
