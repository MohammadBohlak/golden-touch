<script setup lang="ts">
import type { RecurringDetails, RecurringMutation } from '~/types/api'

definePageMeta({ title: 'تعديل الحجز الدوري', permission: 'recurring.manage' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()
const servicesStore = useServicesStore()
const id = String(route.params.id)

// الخدمات لازمة قبل بناء النموذج (قائمة التناوب تعرض أسماءها)
const {
  data: series,
  loading,
  errorMessage,
  execute,
  refresh,
} = useApiState(async (signal) => {
  const [result] = await Promise.all([
    $api<RecurringDetails>(`/recurring-bookings/${id}`, { signal }),
    servicesStore.ensure(),
  ])
  return result
})
onMounted(() => execute())

function onSaved(result: RecurringMutation) {
  invalidateApiCache('stats')
  toast.success('تم حفظ التعديل')
  void navigateTo(`/recurring/${result.series.id}`)
}
</script>

<template>
  <div>
    <PageHeader
      title="تعديل الحجز الدوري"
      :subtitle="series ? series.customer.name : undefined"
      :back="`/recurring/${id}`"
    />
    <Transition name="fade" mode="out-in">
      <LoadingState v-if="loading || (!series && !errorMessage)" key="loading" variant="spinner" />
      <ErrorState v-else-if="errorMessage" key="error" :message="errorMessage" @retry="refresh" />
      <EmptyState
        v-else-if="series && series.status !== 'ACTIVE'"
        key="blocked"
        icon="info"
        title="لا يمكن تعديل هذا الحجز الدوري"
        :description="`الحجز الدوري ${STATUS_LABELS[series.status]}.`"
      >
        <AppButton :to="`/recurring/${id}`" variant="secondary" size="sm"
          >العودة للتفاصيل</AppButton
        >
      </EmptyState>
      <RecurringForm v-else-if="series" key="form" :series="series" @saved="onSaved" />
    </Transition>
  </div>
</template>
