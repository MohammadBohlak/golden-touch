<script setup lang="ts">
import type { Booking, CustomerDetails } from '~/types/api'

definePageMeta({ title: 'ملف الزبون', permission: 'customers.read' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()
const { confirm } = useConfirm()
const { timezone, today } = useShopTime()
const { can } = useAuth()
const id = String(route.params.id)

const { data, loading, errorMessage, execute, refresh } = useApiState((signal) =>
  $api<CustomerDetails>(`/customers/${id}`, { signal }),
)
onMounted(() => execute())

const editOpen = ref(false)
const sheetOpen = ref(false)
const active = ref<Booking | null>(null)

function open(booking: Booking) {
  active.value = booking
  sheetOpen.value = true
}

const whatsapp = computed(() =>
  data.value?.phone ? whatsappLink(data.value.phone, `مرحباً ${data.value.name}، `) : null,
)

async function remove() {
  if (!data.value) return
  const ok = await confirm({
    title: `حذف الزبون "${data.value.name}"؟`,
    message: 'يمكن حذف الزبائن الذين لا يملكون أي حجوزات فقط.',
    confirmLabel: 'حذف',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await $api(`/customers/${id}`, { method: 'DELETE' })
    toast.success('تم حذف الزبون')
    await navigateTo('/customers')
  } catch (error) {
    toast.error(toApiError(error).message)
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader :title="data?.name ?? 'ملف الزبون'" back="/customers">
      <template v-if="data" #actions>
        <AppButton
          v-if="can('customers.update')"
          variant="secondary"
          size="icon"
          icon="pencil"
          aria-label="تعديل"
          @click="editOpen = true"
        />
        <AppButton
          v-if="can('customers.delete') && !data.bookings.length"
          variant="danger-soft"
          size="icon"
          icon="trash"
          aria-label="حذف"
          @click="remove"
        />
      </template>
    </PageHeader>

    <LoadingState v-if="loading && !data" :rows="4" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />

    <template v-else-if="data">
      <div class="flex flex-wrap items-center gap-2">
        <AppButton
          v-if="can('bookings.create')"
          :to="{ path: '/bookings/new', query: { customerId: data.id } }"
          variant="gold"
          icon="calendar-plus"
        >
          حجز جديد له
        </AppButton>
        <AppButton v-if="data.phone" :href="`tel:${data.phone}`" variant="secondary" icon="phone"
          >اتصال</AppButton
        >
        <AppButton
          v-if="whatsapp"
          :href="whatsapp"
          target="_blank"
          rel="noopener"
          variant="secondary"
          icon="message"
          >واتساب</AppButton
        >
      </div>

      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-2xl bg-ink-950 p-4 text-white shadow-card">
          <dt class="text-sm text-ink-300">الزيارات</dt>
          <dd class="text-2xl font-extrabold text-gold-300 tabular-nums">
            {{ data.stats.visits }}
          </dd>
        </div>
        <div class="rounded-2xl bg-surface p-4 shadow-card">
          <dt class="text-sm text-fg-muted">مجموع ما دفعه</dt>
          <dd class="text-xl font-extrabold tabular-nums">
            {{ formatMoney(data.stats.totalSpent) }}
          </dd>
        </div>
        <div class="rounded-2xl bg-surface p-4 shadow-card">
          <dt class="text-sm text-fg-muted">آخر زيارة</dt>
          <dd class="font-bold">
            {{
              data.stats.lastVisitAt
                ? relativeDayLabel(dateInTz(data.stats.lastVisitAt, timezone), today)
                : '—'
            }}
          </dd>
        </div>
        <div class="rounded-2xl bg-surface p-4 shadow-card">
          <dt class="text-sm text-fg-muted">قادمة / ملغاة</dt>
          <dd class="font-bold tabular-nums">
            {{ data.stats.upcoming }} / {{ data.stats.cancelled }}
          </dd>
        </div>
      </dl>

      <div class="rounded-2xl bg-surface p-4 shadow-card">
        <p class="text-sm font-semibold text-fg-muted">الهاتف</p>
        <p class="font-bold tabular-nums" dir="ltr">{{ data.phone ?? '—' }}</p>
        <template v-if="data.notes">
          <p class="mt-3 text-sm font-semibold text-fg-muted">ملاحظات</p>
          <p class="whitespace-pre-line">{{ data.notes }}</p>
        </template>
      </div>

      <section aria-labelledby="history" class="flex flex-col gap-2.5">
        <h2 id="history" class="flex items-center gap-2 font-bold">
          <AppIcon name="history" :size="18" />
          سجل الحجوزات
        </h2>
        <EmptyState
          v-if="!data.bookings.length"
          icon="calendar"
          title="لا توجد حجوزات لهذا الزبون"
        />
        <BookingCard
          v-for="booking in data.bookings"
          :key="booking.id"
          :booking="booking"
          :timezone="timezone"
          show-date
          @open="open"
        />
      </section>
    </template>

    <CustomerFormDialog v-model:open="editOpen" :customer="data" @saved="refresh" />
    <BookingSheet
      v-model:open="sheetOpen"
      :booking="active"
      :timezone="timezone"
      @changed="refresh"
      @deleted="refresh"
    />
  </div>
</template>
