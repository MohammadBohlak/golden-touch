<script setup lang="ts">
import type { RecurringSeries } from '~/types/api'

definePageMeta({ title: 'الحجوزات الدورية', permission: 'recurring.read' })

const { $api } = useNuxtApp()
const { timezone, today } = useShopTime()
const { can } = useAuth()

type Scope = 'active' | 'all'
const scope = ref<Scope>('active')
const scopes: { value: Scope; label: string }[] = [
  { value: 'active', label: 'الفعّالة' },
  { value: 'all', label: 'الكل' },
]

const { data, loading, refreshing, errorMessage, execute, refresh } = useApiState(
  (signal, includeStopped: boolean) =>
    $api<RecurringSeries[]>('/recurring-bookings', {
      query: { includeStopped: includeStopped || undefined },
      signal,
    }),
)
// نُعتّم القائمة عند تبدّل الفلتر فقط، لا عند التحديث الصامت
const switching = computed(() => loading.value && !refreshing.value)

watch(scope, (value) => execute(value === 'all'))
onMounted(() => execute(scope.value === 'all'))
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="الحجوزات الدورية">
      <template #actions>
        <AppButton v-if="can('recurring.manage')" to="/recurring/new" icon="plus">
          <span class="hidden sm:inline">حجز دوري</span>
          <span class="sr-only sm:hidden">حجز دوري جديد</span>
        </AppButton>
      </template>
    </PageHeader>

    <SegmentedControl v-model="scope" :options="scopes" label="عرض الحجوزات الدورية" />

    <FadeTransition>
      <LoadingState v-if="loading && !data" key="loading" :rows="3" />
      <ErrorState v-else-if="errorMessage" key="error" :message="errorMessage" @retry="refresh" />
      <EmptyState
        v-else-if="data && !data.length"
        key="empty"
        icon="repeat"
        :title="scope === 'all' ? 'لا توجد حجوزات دورية' : 'لا توجد حجوزات دورية فعّالة'"
      >
        <AppButton
          v-if="can('recurring.manage')"
          to="/recurring/new"
          variant="gold"
          size="sm"
          icon="plus"
          >حجز دوري جديد</AppButton
        >
      </EmptyState>
      <ListTransition
        v-else-if="data"
        key="list"
        tag="ul"
        :class="
          cn('relative grid gap-2.5 transition-opacity md:grid-cols-2', switching && 'opacity-60')
        "
        appear
        :stagger="35"
      >
        <li v-for="series in data" :key="series.id">
          <RecurringCard
            :series="series"
            :timezone="timezone"
            :today="today"
            :to="`/recurring/${series.id}`"
          />
        </li>
      </ListTransition>
    </FadeTransition>
  </div>
</template>
