<script setup lang="ts">
import type { User } from '~/types/api'
import type { TableColumn } from '~/types/ui'

definePageMeta({ title: 'المستخدمون', permission: 'users.read' })

const usersStore = useUsersStore()
const toast = useToast()
const { confirm } = useConfirm()
const { user: me, can } = useAuth()
const { timezone, today } = useShopTime()

const search = ref(usersStore.search)
const debounced = useDebounced(search)

const { loading, errorMessage, execute, refresh } = useApiState((signal) =>
  usersStore.fetch(signal),
)

watch(debounced, (value) => {
  usersStore.search = value
  usersStore.page = 1
  void execute()
})
watch(
  () => usersStore.page,
  () => execute(),
)
onMounted(() => execute())

// حالة الحوار محلية في الصفحة (وليست في الـ store)
const dialogOpen = ref(false)
const editing = ref<User | null>(null)
function openCreate() {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(user: User) {
  editing.value = user
  dialogOpen.value = true
}

async function remove(user: User) {
  const ok = await confirm({
    title: `حذف حساب "${user.name}"؟`,
    message:
      'لن يستطيع الدخول بعد الآن. الحجوزات التي سجّلها تبقى في السجل. يمكنك بدلاً من ذلك إيقاف الحساب مؤقتاً.',
    confirmLabel: 'حذف الحساب',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await usersStore.remove(user.id)
    toast.success('تم حذف الحساب')
  } catch (error) {
    toast.error(toApiError(error).message)
  }
}

const columns: TableColumn[] = [
  { key: 'name', label: 'الاسم', hideOnMobile: true },
  { key: 'role', label: 'الدور' },
  { key: 'status', label: 'الحالة' },
  { key: 'lastLoginAt', label: 'آخر دخول' },
  { key: 'actions', label: 'إجراءات', class: 'w-28 text-end', hideOnMobile: true },
]

const rows = computed(() => usersStore.items as unknown as Record<string, unknown>[])
const asUser = (row: Record<string, unknown>) => row as unknown as User

function lastLogin(value: string | null) {
  return value
    ? `${relativeDayLabel(dateInTz(value, timezone.value), today.value)} · ${formatTime(value, timezone.value)}`
    : 'لم يدخل بعد'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="المستخدمون" subtitle="حسابات فريق العمل — إنشاء الحسابات متاح للمدير فقط">
      <template #actions>
        <AppButton v-perm="'users.create'" icon="user-plus" @click="openCreate">
          <span class="hidden sm:inline">حساب جديد</span>
          <span class="sr-only sm:hidden">حساب جديد</span>
        </AppButton>
      </template>
    </PageHeader>

    <SearchInput v-model="search" placeholder="ابحث بالاسم أو البريد أو الهاتف" />

    <LoadingState v-if="loading && !usersStore.items.length" :rows="3" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />
    <EmptyState
      v-else-if="!usersStore.items.length"
      icon="users"
      title="لا يوجد مستخدمون مطابقون"
    />

    <DataTable
      v-else
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="المستخدمون"
      :class="loading && 'opacity-60'"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <span
            class="grid size-10 shrink-0 place-items-center rounded-full bg-ink-950 font-bold text-gold-300"
          >
            {{ initials(asUser(row).name) }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-bold">
              {{ asUser(row).name }}
              <span v-if="asUser(row).id === me?.id" class="text-xs font-semibold text-fg-muted"
                >(أنت)</span
              >
            </p>
            <p class="truncate text-sm text-fg-muted" dir="ltr">{{ asUser(row).email }}</p>
          </div>
        </div>
      </template>
      <template #cell-role="{ row }">
        <AppBadge
          :tone="asUser(row).role.name === 'admin' ? 'dark' : 'neutral'"
          :icon="asUser(row).role.name === 'admin' ? 'crown' : 'user'"
        >
          {{ asUser(row).role.label }}
        </AppBadge>
      </template>
      <template #cell-status="{ row }">
        <AppBadge :tone="asUser(row).isActive ? 'success' : 'danger'">
          {{ asUser(row).isActive ? 'مفعّل' : 'موقوف' }}
        </AppBadge>
      </template>
      <template #cell-lastLoginAt="{ row }">
        <span class="text-sm text-fg-muted">{{ lastLogin(asUser(row).lastLoginAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <AppButton
            v-if="can('users.update')"
            variant="ghost"
            size="icon-sm"
            icon="pencil"
            :aria-label="`تعديل ${asUser(row).name}`"
            @click="openEdit(asUser(row))"
          />
          <AppButton
            v-if="can('users.delete') && asUser(row).id !== me?.id"
            variant="ghost"
            size="icon-sm"
            icon="trash"
            class="text-danger"
            :aria-label="`حذف ${asUser(row).name}`"
            @click="remove(asUser(row))"
          />
        </div>
      </template>

      <template #mobile="{ row }">
        <div class="flex items-start gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-full bg-ink-950 font-bold text-gold-300"
          >
            {{ initials(asUser(row).name) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-bold">
              {{ asUser(row).name }}
              <span v-if="asUser(row).id === me?.id" class="text-xs font-semibold text-fg-muted"
                >(أنت)</span
              >
            </p>
            <p class="truncate text-sm text-fg-muted" dir="ltr">{{ asUser(row).email }}</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <AppBadge :tone="asUser(row).role.name === 'admin' ? 'dark' : 'neutral'">{{
                asUser(row).role.label
              }}</AppBadge>
              <AppBadge :tone="asUser(row).isActive ? 'success' : 'danger'">{{
                asUser(row).isActive ? 'مفعّل' : 'موقوف'
              }}</AppBadge>
            </div>
            <p class="mt-1.5 text-xs text-fg-subtle">
              آخر دخول: {{ lastLogin(asUser(row).lastLoginAt) }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <AppButton
              v-if="can('users.update')"
              variant="secondary"
              size="icon-sm"
              icon="pencil"
              :aria-label="`تعديل ${asUser(row).name}`"
              @click="openEdit(asUser(row))"
            />
            <AppButton
              v-if="can('users.delete') && asUser(row).id !== me?.id"
              variant="danger-soft"
              size="icon-sm"
              icon="trash"
              :aria-label="`حذف ${asUser(row).name}`"
              @click="remove(asUser(row))"
            />
          </div>
        </div>
      </template>
    </DataTable>

    <AppPagination
      v-model="usersStore.page"
      :total="usersStore.total"
      :limit="usersStore.limit"
      :disabled="loading"
    />

    <UserFormDialog v-model:open="dialogOpen" :user="editing" />
  </div>
</template>
