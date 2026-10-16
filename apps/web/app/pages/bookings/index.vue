<script setup lang="ts">
import type { Booking, BookingStatus, Paginated } from '~/types/api'

definePageMeta({ title: 'الحجوزات', permission: 'bookings.read' })

const { $api } = useNuxtApp()
const { timezone, today } = useShopTime()
const { can } = useAuth()

const search = ref('')
const debouncedSearch = useDebounced(search)
const status = ref<BookingStatus | 'ALL'>('ALL')
const scope = ref<'upcoming' | 'past' | 'range'>('upcoming')
const from = ref('')
const to = ref('')
const page = ref(1)
const limit = 15

const scopes = [
  { value: 'upcoming' as const, label: 'القادمة' },
  { value: 'past' as const, label: 'السابقة' },
  { value: 'range' as const, label: 'فترة محددة' },
]

const query = computed(() => {
  const base = {
    page: page.value,
    limit,
    search: debouncedSearch.value || undefined,
    status: status.value === 'ALL' ? undefined : status.value,
  }
  if (scope.value === 'upcoming') return { ...base, from: today.value, order: 'asc' as const }
  if (scope.value === 'past')
    return { ...base, to: addDays(today.value, -1), order: 'desc' as const }
  return {
    ...base,
    from: from.value || undefined,
    to: to.value || undefined,
    order: 'desc' as const,
  }
})

const { data, loading, errorMessage, execute, refresh } = useApiState(
  (signal, q: typeof query.value) => $api<Paginated<Booking>>('/bookings', { query: q, signal }),
)

watch([debouncedSearch, status, scope, from, to], () => (page.value = 1))
watch(query, (q) => execute(q))
onMounted(() => execute(query.value))

/** تجميع النتائج حسب اليوم لقراءة أسهل */
const groups = computed(() => {
  const map = new Map<string, Booking[]>()
  for (const booking of data.value?.items ?? []) {
    const key = dateInTz(booking.startAt, timezone.value)
    map.set(key, [...(map.get(key) ?? []), booking])
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

const sheetOpen = ref(false)
const active = ref<Booking | null>(null)
function open(booking: Booking) {
  active.value = booking
  sheetOpen.value = true
}
function onChanged() {
  invalidateApiCache('stats')
  void refresh()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="الحجوزات" subtitle="كل الحجوزات القادمة والسابقة">
      <template #actions>
        <AppButton
          v-if="can('bookings.create')"
          to="/bookings/new"
          variant="gold"
          icon="plus"
          class="hidden lg:inline-flex"
        >
          حجز جديد
        </AppButton>
      </template>
    </PageHeader>

    <SearchInput v-model="search" placeholder="ابحث باسم الزبون أو الهاتف أو الخدمة" />
    <SegmentedControl v-model="scope" :options="scopes" label="الفترة" />

    <div v-if="scope === 'range'" class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="from" class="text-sm font-semibold">من تاريخ</label>
        <AppInput id="from" v-model="from" type="date" :max="to || undefined" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="to" class="text-sm font-semibold">إلى تاريخ</label>
        <AppInput id="to" v-model="to" type="date" :min="from || undefined" />
      </div>
    </div>

    <div
      class="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4"
      role="radiogroup"
      aria-label="حالة الحجز"
    >
      <button
        v-for="f in STATUS_FILTERS"
        :key="f.value"
        type="button"
        role="radio"
        :aria-checked="status === f.value"
        :class="
          cn(
            'h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
            status === f.value
              ? 'border-ink-950 bg-ink-950 text-white'
              : 'border-line-strong bg-surface hover:border-gold-500',
          )
        "
        @click="status = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="data" class="text-sm text-fg-muted" aria-live="polite">{{ data.total }} حجز</p>

    <LoadingState v-if="loading && !data" :rows="6" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />
    <EmptyState
      v-else-if="data && !data.items.length"
      icon="calendar"
      title="لا توجد حجوزات مطابقة"
      :description="
        search ? 'جرّب كلمة بحث أخرى أو غيّر الفلاتر.' : 'ستظهر الحجوزات هنا بعد تسجيلها.'
      "
    >
      <AppButton
        v-if="can('bookings.create') && scope === 'upcoming'"
        to="/bookings/new"
        variant="secondary"
        size="sm"
        icon="plus"
      >
        حجز جديد
      </AppButton>
    </EmptyState>

    <div v-else :class="cn('flex flex-col gap-5 transition-opacity', loading && 'opacity-60')">
      <section v-for="group in groups" :key="group.date" :aria-label="formatDateLong(group.date)">
        <h2 class="mb-2 flex items-center gap-2 text-sm font-bold text-fg-muted">
          <span>{{ relativeDayLabel(group.date, today) }}</span>
          <span
            v-if="relativeDayLabel(group.date, today) !== formatDateLong(group.date)"
            class="font-medium"
          >
            · {{ formatDateShort(group.date, true) }}
          </span>
        </h2>
        <div class="flex flex-col gap-2.5">
          <BookingCard
            v-for="booking in group.items"
            :key="booking.id"
            :booking="booking"
            :timezone="timezone"
            @open="open"
          />
        </div>
      </section>
    </div>

    <AppPagination
      v-if="data"
      v-model="page"
      :total="data.total"
      :limit="limit"
      :disabled="loading"
    />

    <BookingSheet
      v-model:open="sheetOpen"
      :booking="active"
      :timezone="timezone"
      @changed="onChanged"
      @deleted="onChanged"
    />
  </div>
</template>
