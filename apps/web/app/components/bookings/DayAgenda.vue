<script setup lang="ts">
import type { Booking, DaySchedule, Gap } from '~/types/api'

/**
 * خط زمني لليوم: الحجوزات والفراغات المتاحة مرتبة زمنياً بتمييز بصري واضح
 * (حجز = بطاقة بيضاء بحد ملوّن حسب الحالة، متاح = إطار ذهبي متقطع مع زر "احجز").
 */
const props = defineProps<{ day: DaySchedule; minDuration: number; canCreate: boolean }>()
defineEmits<{ open: [booking: Booking]; create: [startAt: string] }>()

type Item =
  | { kind: 'booking'; key: string; at: number; booking: Booking; live: boolean }
  | { kind: 'gap'; key: string; at: number; gap: Gap }
  | { kind: 'now'; key: string; at: number }

const nowMs = computed(() => new Date(props.day.now).getTime())
const showCancelled = ref(false)

const cancelled = computed(() => props.day.bookings.filter((b) => b.status === 'CANCELLED'))

const items = computed<Item[]>(() => {
  const list: Item[] = [
    ...props.day.bookings
      .filter((b) => b.status !== 'CANCELLED')
      .map((booking) => {
        const start = new Date(booking.startAt).getTime()
        const end = new Date(booking.endAt).getTime()
        return {
          kind: 'booking' as const,
          key: booking.id,
          at: start,
          booking,
          live: booking.status === 'ACTIVE' && start <= nowMs.value && nowMs.value < end,
        }
      }),
    ...props.day.gaps.map((gap) => ({
      kind: 'gap' as const,
      key: `gap-${gap.start}`,
      at: new Date(gap.start).getTime(),
      gap,
    })),
  ].sort((a, b) => a.at - b.at)

  const windowStart = new Date(props.day.window.start).getTime()
  const windowEnd = new Date(props.day.window.end).getTime()
  if (nowMs.value >= windowStart && nowMs.value < windowEnd) {
    const index = list.findIndex((item) => item.at > nowMs.value)
    const marker: Item = { kind: 'now', key: 'now', at: nowMs.value }
    if (index === -1) list.push(marker)
    else list.splice(index, 0, marker)
  }
  return list
})

const hasBookable = computed(() =>
  props.day.gaps.some((g) => !g.past && g.minutes >= props.minDuration),
)
</script>

<template>
  <section aria-label="جدول اليوم" class="flex flex-col gap-2.5">
    <div
      v-if="day.closed"
      class="flex items-start gap-2 rounded-2xl bg-warning-soft p-3 text-sm font-semibold text-amber-900"
    >
      <AppIcon name="info" :size="18" class="mt-0.5" />
      <span>هذا اليوم عطلة أسبوعية — ما زال بإمكانك تسجيل حجز استثنائي.</span>
    </div>

    <template v-for="item in items" :key="item.key">
      <BookingCard
        v-if="item.kind === 'booking'"
        :booking="item.booking"
        :timezone="day.timezone"
        :live="item.live"
        @open="$emit('open', $event)"
      />
      <GapCard
        v-else-if="item.kind === 'gap'"
        :gap="item.gap"
        :timezone="day.timezone"
        :min-duration="minDuration"
        :can-create="canCreate"
        @create="$emit('create', $event)"
      />
      <div v-else class="flex items-center gap-2 py-0.5" role="separator" aria-label="الوقت الحالي">
        <span class="size-2.5 rounded-full bg-danger ring-4 ring-red-100" />
        <span class="text-xs font-bold text-danger tabular-nums"
          >الآن {{ formatTime(day.now, day.timezone) }}</span
        >
        <span class="h-0.5 flex-1 rounded bg-danger/70" />
      </div>
    </template>

    <EmptyState
      v-if="!items.length"
      icon="calendar"
      title="لا يوجد دوام في هذا اليوم"
      description="غيّر ساعات الدوام من إعدادات الصالون."
    />
    <p v-else-if="!hasBookable && !day.bookings.length" class="text-center text-sm text-fg-muted">
      انتهى دوام هذا اليوم.
    </p>

    <div v-if="cancelled.length" class="mt-2">
      <button
        type="button"
        class="flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-fg-muted hover:bg-surface-muted"
        :aria-expanded="showCancelled"
        @click="showCancelled = !showCancelled"
      >
        <span class="flex items-center gap-2">
          <AppIcon name="ban" :size="16" />
          حجوزات ملغاة ({{ cancelled.length }})
        </span>
        <AppIcon
          name="chevron-down"
          :size="18"
          :class="cn('transition-transform', showCancelled && 'rotate-180')"
        />
      </button>
      <div v-if="showCancelled" class="mt-2 flex flex-col gap-2.5">
        <BookingCard
          v-for="booking in cancelled"
          :key="booking.id"
          :booking="booking"
          :timezone="day.timezone"
          @open="$emit('open', $event)"
        />
      </div>
    </div>
  </section>
</template>
