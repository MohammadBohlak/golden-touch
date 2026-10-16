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
    <LoadingState v-if="loading || (!booking && !errorMessage)" variant="spinner" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />
    <template v-else-if="booking">
      <EmptyState
        v-if="booking.status !== 'ACTIVE'"
        icon="info"
        title="لا يمكن تعديل موعد هذا الحجز"
        :description="`الحجز ${STATUS_META[booking.status].label}. أعد فتحه من تفاصيل الحجز أولاً.`"
      >
        <AppButton to="/" variant="secondary" size="sm">العودة للجدول</AppButton>
      </EmptyState>
      <BookingForm v-else :booking="booking" @saved="onSaved" />
    </template>
  </div>
</template>
