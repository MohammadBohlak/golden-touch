<script setup lang="ts">
import type { Customer, CustomerRef, Paginated } from '~/types/api'

definePageMeta({ title: 'الزبائن', permission: 'customers.read' })

const { $api } = useNuxtApp()
const { timezone, today } = useShopTime()
const { can } = useAuth()

const search = ref('')
const debounced = useDebounced(search)
const page = ref(1)
const limit = 20

const { data, loading, errorMessage, execute, refresh } = useApiState(
  (signal, p: number, q: string) =>
    $api<Paginated<Customer>>('/customers', {
      query: { page: p, limit, search: q || undefined },
      signal,
    }),
)

watch(debounced, () => (page.value = 1))
watch([page, debounced], ([p, q]) => execute(p, q))
onMounted(() => execute(page.value, debounced.value))

const dialogOpen = ref(false)
function onSaved(customer: CustomerRef) {
  void navigateTo(`/customers/${customer.id}`)
}

function lastVisitLabel(value: string | null) {
  if (!value) return 'لم يزر بعد'
  return `آخر زيارة: ${relativeDayLabel(dateInTz(value, timezone.value), today.value)}`
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="الزبائن" subtitle="سجل الزبائن وعدد زياراتهم">
      <template #actions>
        <AppButton v-if="can('customers.create')" icon="user-plus" @click="dialogOpen = true">
          <span class="hidden sm:inline">زبون جديد</span>
          <span class="sr-only sm:hidden">زبون جديد</span>
        </AppButton>
      </template>
    </PageHeader>

    <SearchInput v-model="search" placeholder="ابحث بالاسم أو رقم الهاتف" />

    <LoadingState v-if="loading && !data" :rows="6" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />
    <EmptyState
      v-else-if="data && !data.items.length"
      icon="users"
      :title="search ? 'لا يوجد زبون مطابق' : 'لا يوجد زبائن بعد'"
      :description="
        search ? 'جرّب البحث برقم الهاتف.' : 'يُضاف الزبون تلقائياً عند تسجيل أول حجز له.'
      "
    />
    <ul v-else-if="data" :class="cn('grid gap-2.5 md:grid-cols-2', loading && 'opacity-60')">
      <li v-for="customer in data.items" :key="customer.id">
        <NuxtLink
          :to="`/customers/${customer.id}`"
          class="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card transition-shadow hover:shadow-float"
        >
          <span
            class="grid size-12 shrink-0 place-items-center rounded-full bg-ink-950 font-bold text-gold-300"
          >
            {{ initials(customer.name) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-bold">{{ customer.name }}</span>
            <span class="block text-sm text-fg-muted tabular-nums" dir="ltr">{{
              customer.phone ?? '—'
            }}</span>
            <span class="block text-xs text-fg-subtle">{{
              lastVisitLabel(customer.lastVisitAt)
            }}</span>
          </span>
          <span class="flex flex-col items-center rounded-xl bg-gold-50 px-3 py-1.5">
            <span class="text-lg leading-tight font-extrabold text-gold-800 tabular-nums">{{
              customer.visits
            }}</span>
            <span class="text-[10px] font-bold text-gold-700">زيارة</span>
          </span>
        </NuxtLink>
      </li>
    </ul>

    <AppPagination
      v-if="data"
      v-model="page"
      :total="data.total"
      :limit="limit"
      :disabled="loading"
    />

    <CustomerFormDialog v-model:open="dialogOpen" @saved="onSaved" />
  </div>
</template>
