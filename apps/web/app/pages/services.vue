<script setup lang="ts">
import type { Service } from '~/types/api'

definePageMeta({ title: 'الخدمات والأسعار', permission: 'services.read' })

const servicesStore = useServicesStore()
const toast = useToast()
const { confirm } = useConfirm()
const { can } = useAuth()

const { loading, errorMessage, refresh } = useApiState(() => servicesStore.ensure(true), {
  immediate: true,
})

const dialogOpen = ref(false)
const editing = ref<Service | null>(null)

function openCreate() {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(service: Service) {
  editing.value = service
  dialogOpen.value = true
}

async function toggle(service: Service) {
  try {
    await servicesStore.update(service.id, { isActive: !service.isActive })
    toast.success(
      service.isActive ? `عُطّلت خدمة "${service.name}"` : `فُعّلت خدمة "${service.name}"`,
    )
  } catch (error) {
    toast.error(toApiError(error).message)
  }
}

async function remove(service: Service) {
  const ok = await confirm({
    title: `حذف خدمة "${service.name}"؟`,
    message: 'إن كانت مرتبطة بحجوزات سابقة ستُؤرشف بدلاً من الحذف للحفاظ على السجل والإحصائيات.',
    confirmLabel: 'حذف',
    tone: 'danger',
  })
  if (!ok) return
  try {
    const { archived } = await servicesStore.remove(service.id)
    toast.success(archived ? 'أُرشفت الخدمة (مرتبطة بحجوزات سابقة)' : 'تم حذف الخدمة')
  } catch (error) {
    toast.error(toApiError(error).message)
  }
}

/** تبديل ترتيب خدمتين ثم إعادة ترقيم القائمة (1..n) وحفظ ما تغيّر فقط */
async function move(service: Service, direction: -1 | 1) {
  const list = [...servicesStore.items]
  const index = list.findIndex((s) => s.id === service.id)
  const target = index + direction
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target]!, list[index]!]
  const changes = list
    .map((s, i) => ({ id: s.id, sortOrder: i + 1, changed: s.sortOrder !== i + 1 }))
    .filter((c) => c.changed)
  servicesStore.items = list.map((s, i) => ({ ...s, sortOrder: i + 1 }))
  try {
    await Promise.all(changes.map((c) => servicesStore.update(c.id, { sortOrder: c.sortOrder })))
  } catch (error) {
    toast.error(toApiError(error).message)
    await servicesStore.ensure(true)
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="الخدمات والأسعار" subtitle="السعر بالليرة السورية ومدة التنفيذ لكل خدمة">
      <template #actions>
        <AppButton v-perm="'services.create'" icon="plus" @click="openCreate">
          <span class="hidden sm:inline">خدمة جديدة</span>
          <span class="sr-only sm:hidden">خدمة جديدة</span>
        </AppButton>
      </template>
    </PageHeader>

    <LoadingState v-if="loading && !servicesStore.loaded" :rows="4" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />
    <EmptyState
      v-else-if="!servicesStore.items.length"
      icon="scissors"
      title="لا توجد خدمات"
      description="أضف أول خدمة مع سعرها ومدتها."
    >
      <AppButton
        v-if="can('services.create')"
        variant="secondary"
        size="sm"
        icon="plus"
        @click="openCreate"
        >خدمة جديدة</AppButton
      >
    </EmptyState>

    <ul v-else class="flex flex-col gap-2.5">
      <li
        v-for="(service, index) in servicesStore.items"
        :key="service.id"
        :class="
          cn(
            'flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card',
            !service.isActive && 'opacity-70',
          )
        "
      >
        <div v-if="can('services.update')" class="flex flex-col">
          <button
            type="button"
            class="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted disabled:opacity-30"
            :disabled="index === 0"
            :aria-label="`نقل ${service.name} للأعلى`"
            @click="move(service, -1)"
          >
            <AppIcon name="chevron-down" :size="16" class="rotate-180" />
          </button>
          <button
            type="button"
            class="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted disabled:opacity-30"
            :disabled="index === servicesStore.items.length - 1"
            :aria-label="`نقل ${service.name} للأسفل`"
            @click="move(service, 1)"
          >
            <AppIcon name="chevron-down" :size="16" />
          </button>
        </div>
        <span class="grid size-12 shrink-0 place-items-center rounded-xl bg-ink-950 text-gold-300">
          <AppIcon name="scissors" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="flex flex-wrap items-center gap-2 font-bold">
            {{ service.name }}
            <AppBadge v-if="!service.isActive" tone="neutral">معطّلة</AppBadge>
            <AppBadge v-else-if="!service.price" tone="warning" icon="alert"
              >السعر غير محدد</AppBadge
            >
          </p>
          <p class="text-sm text-fg-muted">
            <span class="font-bold text-brand-ink tabular-nums">{{
              formatMoney(service.price)
            }}</span>
            · {{ formatDuration(service.durationMinutes) }}
          </p>
        </div>
        <div v-if="can('services.update')" class="flex items-center gap-1">
          <AppButton
            variant="ghost"
            size="icon"
            :icon="service.isActive ? 'eye-off' : 'eye'"
            :aria-label="service.isActive ? `تعطيل ${service.name}` : `تفعيل ${service.name}`"
            @click="toggle(service)"
          />
          <AppButton
            variant="ghost"
            size="icon"
            icon="pencil"
            :aria-label="`تعديل ${service.name}`"
            @click="openEdit(service)"
          />
          <AppButton
            v-if="can('services.delete')"
            variant="ghost"
            size="icon"
            icon="trash"
            class="text-danger"
            :aria-label="`حذف ${service.name}`"
            @click="remove(service)"
          />
        </div>
      </li>
    </ul>

    <p v-if="!can('services.update')" class="text-center text-sm text-fg-muted">
      تعديل الخدمات والأسعار متاح للمدير فقط.
    </p>

    <ServiceFormDialog v-model:open="dialogOpen" :service="editing" />
  </div>
</template>
