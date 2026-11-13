<script setup lang="ts">
import type { Booking, RecurringDetails, RecurringMutation } from '~/types/api'

definePageMeta({ title: 'الحجز الدوري', permission: 'recurring.read' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()
const { confirm } = useConfirm()
const { timezone, today } = useShopTime()
const { can } = useAuth()
const id = String(route.params.id)

const { data, loading, errorMessage, execute, refresh } = useApiState((signal) =>
  $api<RecurringDetails>(`/recurring-bookings/${id}`, { signal }),
)
onMounted(() => execute())

const sheetOpen = ref(false)
const active = ref<Booking | null>(null)
function open(booking: Booking) {
  active.value = booking
  sheetOpen.value = true
}

const isActive = computed(() => data.value?.status === 'ACTIVE')
const stopping = ref(false)

/** مواعيد قادمة سيحذفها الإيقاف: قيد العمل وغير معدّلة يدوياً (يطابق قاعدة الخادم D10) */
function stopCounts(series: RecurringDetails) {
  const now = Date.now()
  const upcoming = series.upcoming.filter(
    (b) => b.status === 'ACTIVE' && new Date(b.startAt).getTime() > now,
  )
  const kept = upcoming.filter((b) => b.recurringEdited).length
  return { removed: upcoming.length - kept, kept }
}

async function stop() {
  if (!data.value) return
  const { removed, kept } = stopCounts(data.value)
  const ok = await confirm({
    title: 'إيقاف الحجز الدوري؟',
    message:
      `ستُحذف المواعيد القادمة غير المعدّلة (${removed}) ولن يُولَّد غيرها.` +
      (kept ? ` وتبقى المواعيد التي عُدّلت يدوياً (${kept}).` : ''),
    confirmLabel: 'إيقاف',
    tone: 'danger',
  })
  if (!ok) return
  stopping.value = true
  try {
    const result = await $api<RecurringMutation>(`/recurring-bookings/${id}/stop`, {
      method: 'POST',
    })
    data.value = result.series
    invalidateApiCache('stats')
    toast.success('تم إيقاف الحجز الدوري')
  } catch (error) {
    toast.error(toApiError(error).message)
  } finally {
    stopping.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader :title="data?.customer.name ?? 'الحجز الدوري'" back="/recurring">
      <template v-if="data && isActive && can('recurring.manage')" #actions>
        <AppButton
          :to="`/recurring/${id}/edit`"
          variant="secondary"
          size="icon"
          icon="pencil"
          aria-label="تعديل"
        />
      </template>
    </PageHeader>

    <FadeTransition>
      <LoadingState v-if="loading && !data" key="loading" :rows="4" />
      <ErrorState v-else-if="errorMessage" key="error" :message="errorMessage" @retry="refresh" />

      <div v-else-if="data" key="content" class="flex flex-col gap-4">
        <RecurringCard :series="data" :timezone="timezone" :today="today" />

        <ExpandTransition>
          <div v-if="data.notes" class="rounded-2xl bg-gold-50 p-3.5">
            <p class="text-sm font-semibold text-gold-800">ملاحظات</p>
            <p class="whitespace-pre-line">{{ data.notes }}</p>
          </div>
        </ExpandTransition>

        <section aria-labelledby="upcoming" class="flex flex-col gap-2.5">
          <h2 id="upcoming" class="flex items-center gap-2 font-bold">
            <AppIcon name="calendar" :size="18" />
            المواعيد القادمة
          </h2>
          <ExpandTransition>
            <EmptyState v-if="!data.upcoming.length" icon="calendar" title="لا توجد مواعيد قادمة" />
          </ExpandTransition>
          <ListTransition class="relative flex flex-col gap-2.5">
            <BookingCard
              v-for="booking in data.upcoming"
              :key="booking.id"
              :booking="booking"
              :timezone="timezone"
              show-date
              @open="open"
            />
          </ListTransition>
        </section>

        <ExpandTransition>
          <AppButton
            v-if="isActive && can('recurring.manage')"
            variant="danger-soft"
            icon="ban"
            class="self-start"
            :loading="stopping"
            @click="stop"
          >
            إيقاف الحجز الدوري
          </AppButton>
        </ExpandTransition>
      </div>
    </FadeTransition>

    <BookingSheet
      v-model:open="sheetOpen"
      :booking="active"
      :timezone="timezone"
      @changed="refresh"
      @deleted="refresh"
    />
  </div>
</template>
