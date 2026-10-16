<script setup lang="ts">
import type { Booking } from '~/types/api'

/** تنبيه بالحجوزات التي انتهى وقتها وما زالت "قيد العمل" — تحتاج إكمالاً أو إلغاءً */
const props = defineProps<{ bookings: Booking[]; timezone: string }>()
defineEmits<{ open: [booking: Booking] }>()

const expanded = ref(false)
const visible = computed(() => (expanded.value ? props.bookings : props.bookings.slice(0, 2)))
</script>

<template>
  <section
    v-if="bookings.length"
    aria-labelledby="overdue-title"
    class="rounded-3xl border border-amber-200 bg-warning-soft p-4"
  >
    <div class="flex items-start gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-warning">
        <AppIcon name="hourglass" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 id="overdue-title" class="font-extrabold text-amber-950">
          {{
            bookings.length === 1
              ? 'حجز انتهى وقته ولم يُغلق'
              : `${bookings.length} حجوزات انتهى وقتها ولم تُغلق`
          }}
        </h2>
        <p class="text-sm text-amber-900">سجّل الدفع أو ألغِ الحجز حتى تبقى الإحصائيات دقيقة.</p>
      </div>
    </div>
    <ul class="mt-3 flex flex-col gap-2">
      <li v-for="booking in visible" :key="booking.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-start shadow-card hover:shadow-float"
          @click="$emit('open', booking)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate font-bold"
              >{{ booking.customer.name }} · {{ booking.serviceName }}</span
            >
            <span class="block text-sm text-fg-muted">{{
              formatDateTime(booking.startAt, timezone)
            }}</span>
          </span>
          <span class="text-sm font-bold text-brand-ink">إغلاق</span>
          <AppIcon name="chevron-right" :size="16" class="text-fg-subtle" />
        </button>
      </li>
    </ul>
    <button
      v-if="bookings.length > 2"
      type="button"
      class="mt-2 h-10 text-sm font-bold text-amber-900 underline-offset-4 hover:underline"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'عرض أقل' : `عرض الكل (${bookings.length})` }}
    </button>
  </section>
</template>
