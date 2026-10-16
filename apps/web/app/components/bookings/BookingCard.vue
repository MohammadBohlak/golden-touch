<script setup lang="ts">
import type { Booking } from '~/types/api'

const props = withDefaults(
  defineProps<{
    booking: Booking
    timezone: string
    /** إظهار التاريخ (في السجل) بدلاً من الوقت فقط */
    showDate?: boolean
    /** الحجز جارٍ الآن */
    live?: boolean
  }>(),
  { showDate: false, live: false },
)
defineEmits<{ open: [booking: Booking] }>()

const meta = computed(() => STATUS_META[props.booking.status])
const cancelled = computed(() => props.booking.status === 'CANCELLED')
const amount = computed(() =>
  props.booking.status === 'COMPLETED' ? props.booking.paidAmount : props.booking.price,
)
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'group flex w-full items-stretch gap-3 rounded-2xl border border-s-4 border-line bg-surface p-3 text-start shadow-card transition-[box-shadow,transform] active:scale-[0.99]',
        'hover:shadow-float',
        meta.accent,
        live && 'ring-2 ring-gold-300',
        cancelled && 'bg-surface/70',
      )
    "
    :aria-label="`${booking.customer.name}، ${booking.serviceName}، ${formatTimeRange(booking.startAt, booking.endAt, timezone)}، ${meta.label}`"
    @click="$emit('open', booking)"
  >
    <div
      class="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-muted py-1.5 text-center"
    >
      <template v-if="showDate">
        <span class="text-xs font-semibold text-fg-muted">{{
          WEEKDAY_SHORT[weekdayOf(dateInTz(booking.startAt, timezone))]
        }}</span>
        <span class="text-lg leading-tight font-extrabold tabular-nums">{{
          dayOfMonth(dateInTz(booking.startAt, timezone))
        }}</span>
        <span class="text-[11px] font-semibold text-fg-muted tabular-nums">{{
          formatTime(booking.startAt, timezone)
        }}</span>
      </template>
      <template v-else>
        <span class="text-lg leading-tight font-extrabold tabular-nums">{{
          formatClock(booking.startAt, timezone)
        }}</span>
        <span class="text-[11px] font-semibold text-fg-muted">{{
          formatMeridiem(booking.startAt, timezone)
        }}</span>
      </template>
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
      <div class="flex items-center gap-2">
        <p
          :class="
            cn('min-w-0 flex-1 truncate font-bold', cancelled && 'text-fg-muted line-through')
          "
        >
          {{ booking.customer.name }}
        </p>
        <span
          v-if="live"
          class="inline-flex h-6 items-center gap-1 rounded-full bg-ink-950 px-2 text-[11px] font-bold text-gold-300"
        >
          <span class="size-1.5 animate-pulse rounded-full bg-gold-300" />
          الآن
        </span>
        <StatusBadge v-else :status="booking.status" />
      </div>
      <p class="truncate text-sm text-fg-muted">
        <span class="font-semibold text-fg">{{ booking.serviceName }}</span>
        · {{ formatDuration(booking.durationMinutes) }}
        <template v-if="!showDate"> · حتى {{ formatTime(booking.endAt, timezone) }}</template>
      </p>
      <p
        class="text-sm font-bold tabular-nums"
        :class="booking.status === 'COMPLETED' ? 'text-success' : 'text-brand-ink'"
      >
        {{ formatMoney(amount) }}
        <span v-if="booking.status === 'COMPLETED'" class="text-xs font-semibold text-fg-muted"
          >مدفوع</span
        >
      </p>
    </div>

    <AppIcon
      name="chevron-right"
      :size="18"
      class="shrink-0 self-center text-fg-subtle transition-transform group-hover:translate-x-[-2px]"
    />
  </button>
</template>
