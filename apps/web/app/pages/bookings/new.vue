<script setup lang="ts">
import type { Booking, CustomerDetails, CustomerRef } from '~/types/api'

definePageMeta({ title: 'حجز جديد', permission: 'bookings.create' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()
const { timezone } = useShopTime()

const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined)
const initialStart = str(route.query.start) ?? null
const initialDate = str(route.query.date)
const customerId = str(route.query.customerId)

// زبون محدد مسبقاً (من ملف الزبون)
const customer = ref<CustomerRef | null>(null)
const ready = ref(!customerId)
onMounted(async () => {
  if (!customerId) return
  try {
    const details = await $api<CustomerDetails>(`/customers/${customerId}`)
    customer.value = { id: details.id, name: details.name, phone: details.phone }
  } catch {
    customer.value = null
  } finally {
    ready.value = true
  }
})

function onSaved(booking: Booking) {
  invalidateApiCache('stats')
  toast.success(
    `تم تثبيت حجز ${booking.customer.name} — ${formatDateTime(booking.startAt, timezone.value)}`,
  )
  void navigateTo({ path: '/', query: { date: dateInTz(booking.startAt, timezone.value) } })
}
</script>

<template>
  <div>
    <PageHeader title="حجز جديد" subtitle="حجز فوري أو مجدول لأي يوم قادم" back="/" />
    <Transition name="fade" mode="out-in">
      <LoadingState v-if="!ready" key="loading" variant="spinner" />
      <BookingForm
        v-else
        key="form"
        :initial-start="initialStart"
        :initial-date="initialDate"
        :initial-customer="customer"
        @saved="onSaved"
      />
    </Transition>
  </div>
</template>
