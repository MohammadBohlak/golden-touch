<script setup lang="ts">
import type { Booking } from '~/types/api'

definePageMeta({ title: 'تعديل الحجز', permission: 'bookings.update' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()
const { timezone } = useShopTime()
const servicesStore = useServicesStore()
const id = String(route.params.id)

// نحتاج الخدمات قبل بناء النموذج لمعرفة إن كانت المدة/السعر مخصصين
const {
  data: booking,
  loading,
  errorMessage,
  execute,
  refresh,
} = useApiState(async (signal) => {
  const [result] = await Promise.all([
    $api<Booking>(`/bookings/${id}`, { signal }),
    servicesStore.ensure(),
  ])
  return result
})
onMounted(() => execute())

function onSaved(saved: Booking) {
  invalidateApiCache('stats')
  toast.success('تم حفظ التعديل')
  void navigateTo({ path: '/', query: { date: dateInTz(saved.startAt, timezone.value) } })
}
</script>

<template>
  <div>
    <PageHeader
      title="تعديل الحجز"
      :subtitle="booking ? booking.customer.name : undefined"
      back="/"
    />
    <!-- فروع مسطّحة بعنصر جذر واحد لكل حالة (شرط Transition) -->
    <Transition name="fade" mode="out-in">
      <LoadingState v-if="loading || (!booking && !errorMessage)" key="loading" variant="spinner" />
      <ErrorState v-else-if="errorMessage" key="error" :message="errorMessage" @retry="refresh" />
      <EmptyState
        v-else-if="booking && booking.status !== 'ACTIVE'"
        key="blocked"
        icon="info"
        title="لا يمكن تعديل موعد هذا الحجز"
        :description="`الحجز ${STATUS_META[booking.status].label}. أعد فتحه من تفاصيل الحجز أولاً.`"
      >
        <AppButton to="/" variant="secondary" size="sm">العودة للجدول</AppButton>
      </EmptyState>
      <div v-else-if="booking" key="form" class="flex flex-col gap-4">
        <div
          v-if="booking.recurringId"
          class="flex items-start gap-2 rounded-2xl bg-gold-50 p-3 text-sm text-gold-800"
        >
          <AppIcon name="repeat" :size="18" class="mt-0.5 shrink-0" />
          <p>موعد من حجز دوري: تعديلك لهذا الموعد وحده، ولن يتغيّر بتعديل الحجز الدوري لاحقاً.</p>
        </div>
        <BookingForm :booking="booking" @saved="onSaved" />
      </div>
    </Transition>
  </div>
</template>
