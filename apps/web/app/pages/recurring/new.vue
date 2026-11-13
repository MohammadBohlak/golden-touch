<script setup lang="ts">
import type { CustomerDetails, CustomerRef, RecurringMutation } from '~/types/api'

definePageMeta({ title: 'حجز دوري جديد', permission: 'recurring.manage' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()

const customerId =
  typeof route.query.customerId === 'string' && route.query.customerId
    ? route.query.customerId
    : undefined

// تعبئة مسبقة من «اجعله دورياً» (تاريخ/وقت/خدمة) إن وُجدت
const prefill = parseRecurringPrefill(route.query)

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

function onSaved(result: RecurringMutation) {
  invalidateApiCache('stats')
  toast.success(
    result.created
      ? `تم تثبيت الحجز الدوري — ${countAppointments(result.created)}`
      : 'تم تثبيت الحجز الدوري',
  )
  void navigateTo(`/recurring/${result.series.id}`)
}
</script>

<template>
  <div>
    <PageHeader title="حجز دوري جديد" back="/recurring" />
    <Transition name="fade" mode="out-in">
      <LoadingState v-if="!ready" key="loading" variant="spinner" />
      <RecurringForm
        v-else
        key="form"
        :initial-customer="customer"
        :prefill="prefill"
        @saved="onSaved"
      />
    </Transition>
  </div>
</template>
