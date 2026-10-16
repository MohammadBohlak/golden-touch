<script setup lang="ts">
definePageMeta({ title: 'المزيد' })

const { items } = useNavigation('more')
const { user, logout } = useAuth()
const { confirm } = useConfirm()

async function onLogout() {
  if (await confirm({ title: 'تسجيل الخروج؟', confirmLabel: 'خروج' })) await logout()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="المزيد" />

    <NuxtLink
      v-if="user"
      to="/account"
      class="flex items-center gap-4 rounded-3xl bg-ink-950 p-4 text-white shadow-card"
    >
      <span
        class="grid size-12 shrink-0 place-items-center rounded-full bg-gold-300 text-lg font-extrabold text-ink-950"
      >
        {{ initials(user.name) }}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate font-bold">{{ user.name }}</span>
        <span class="block text-sm text-gold-300">{{ user.role.label }}</span>
      </span>
      <AppIcon name="chevron-right" class="text-ink-400" />
    </NuxtLink>

    <nav aria-label="أقسام إضافية">
      <ul class="overflow-hidden rounded-3xl bg-surface shadow-card">
        <li v-for="(item, i) in items" :key="item.key" :class="i > 0 && 'border-t border-line'">
          <NuxtLink
            :to="item.to"
            class="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted"
          >
            <span
              class="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700"
            >
              <AppIcon :name="item.icon" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-bold">{{ item.label }}</span>
              <span v-if="item.description" class="block text-sm text-fg-muted">{{
                item.description
              }}</span>
            </span>
            <AppIcon name="chevron-right" :size="18" class="text-fg-subtle" />
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <AppButton variant="danger-soft" size="lg" icon="logout" block class="mt-2" @click="onLogout"
      >تسجيل الخروج</AppButton
    >

    <p class="text-center text-xs text-fg-subtle">
      Golden Touch · اللمسة الذهبية
      <br />
      أضف الموقع إلى الشاشة الرئيسية لهاتفك ليعمل كتطبيق.
    </p>
  </div>
</template>
