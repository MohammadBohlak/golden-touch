<script setup lang="ts">
import type { Booking, CustomerDetails, RecurringSeries } from '~/types/api'

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

// الحجوزات الدورية لهذا الزبون (لا تُعرض إلا إن وُجدت)
const recurring = useApiState((signal) =>
  $api<RecurringSeries[]>('/recurring-bookings', { query: { customerId: id }, signal }),
)
onMounted(() => {
  if (can('recurring.read')) void recurring.execute()
})

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

    <FadeTransition>
      <LoadingState v-if="loading && !data" key="loading" :rows="4" />
      <ErrorState v-else-if="errorMessage" key="error" :message="errorMessage" @retry="refresh" />

      <div v-else-if="data" key="content" class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <AppButton
            v-if="can('bookings.create')"
            :to="{ path: '/bookings/new', query: { customerId: data.id } }"
            variant="gold"
            icon="calendar-plus"
          >
            حجز جديد له
          </AppButton>
          <AppButton
            v-if="can('recurring.manage')"
            :to="{ path: '/recurring/new', query: { customerId: data.id } }"
            variant="secondary"
            icon="repeat"
          >
            حجز دوري له
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
          <template v-if="data.stats.visits !== undefined">
            <div class="rounded-2xl bg-ink-950 p-4 text-white shadow-card">
              <dt class="text-sm text-ink-300">الزيارات</dt>
              <dd class="text-2xl font-extrabold text-gold-300 tabular-nums">
                <AnimatedNumber :value="data.stats.visits" appear />
              </dd>
            </div>
            <div
              v-if="data.stats.totalSpent !== undefined"
              class="rounded-2xl bg-surface p-4 shadow-card"
            >
              <dt class="text-sm text-fg-muted">مجموع ما دفعه</dt>
              <dd class="text-xl font-extrabold tabular-nums">
                <AnimatedNumber :value="data.stats.totalSpent" :format="formatMoney" appear />
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
            <div
              :class="
                cn(
                  'rounded-2xl bg-surface p-4 shadow-card',
                  data.stats.totalSpent === undefined && 'col-span-2 lg:col-span-1',
                )
              "
            >
              <dt class="text-sm text-fg-muted">قادمة / ملغاة</dt>
              <dd class="font-bold tabular-nums">
                <AnimatedNumber :value="data.stats.upcoming" appear /> /
                <AnimatedNumber :value="data.stats.cancelled ?? 0" appear />
              </dd>
            </div>
          </template>
          <div
            v-else
            class="col-span-2 rounded-2xl bg-ink-950 p-4 text-white shadow-card lg:col-span-4"
          >
            <dt class="text-sm text-ink-300">حجوزات قادمة</dt>
            <dd class="text-2xl font-extrabold text-gold-300 tabular-nums">
              <AnimatedNumber :value="data.stats.upcoming" appear />
            </dd>
          </div>
        </dl>

        <div class="rounded-2xl bg-surface p-4 shadow-card">
          <p class="text-sm font-semibold text-fg-muted">الهاتف</p>
          <p class="font-bold tabular-nums" dir="ltr">{{ data.phone ?? '—' }}</p>
          <ExpandTransition>
            <div v-if="data.notes" class="pt-3">
              <p class="text-sm font-semibold text-fg-muted">ملاحظات</p>
              <p class="whitespace-pre-line">{{ data.notes }}</p>
            </div>
          </ExpandTransition>
        </div>

        <ExpandTransition>
          <section
            v-if="recurring.data.value?.length"
            aria-labelledby="recurring-title"
            class="flex flex-col gap-2.5"
          >
            <h2 id="recurring-title" class="flex items-center gap-2 font-bold">
              <AppIcon name="repeat" :size="18" />
              الحجوزات الدورية
            </h2>
            <ul class="grid gap-2.5 md:grid-cols-2">
              <li v-for="series in recurring.data.value" :key="series.id">
                <RecurringCard
                  :series="series"
                  :timezone="timezone"
                  :today="today"
                  :to="`/recurring/${series.id}`"
                />
              </li>
            </ul>
          </section>
        </ExpandTransition>

        <section aria-labelledby="history" class="flex flex-col gap-2.5">
          <h2 id="history" class="flex items-center gap-2 font-bold">
            <AppIcon :name="data.stats.visits !== undefined ? 'history' : 'calendar'" :size="18" />
            {{ data.stats.visits !== undefined ? 'سجل الحجوزات' : 'الحجوزات القادمة' }}
          </h2>
          <ExpandTransition>
            <EmptyState
              v-if="!data.bookings.length"
              icon="calendar"
              :title="
                data.stats.visits !== undefined
                  ? 'لا توجد حجوزات لهذا الزبون'
                  : 'لا توجد حجوزات قادمة لهذا الزبون'
              "
            />
          </ExpandTransition>
          <ListTransition class="relative flex flex-col gap-2.5">
            <BookingCard
              v-for="booking in data.bookings"
              :key="booking.id"
              :booking="booking"
              :timezone="timezone"
              show-date
              @open="open"
            />
          </ListTransition>
        </section>
      </div>
    </FadeTransition>

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
