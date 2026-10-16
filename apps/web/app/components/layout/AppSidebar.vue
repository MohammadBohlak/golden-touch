<script setup lang="ts">
const { items, isActive } = useNavigation('sidebar')
const { user, logout, can } = useAuth()
const confirmLogout = useConfirm().confirm

async function onLogout() {
  if (await confirmLogout({ title: 'تسجيل الخروج؟', confirmLabel: 'خروج' })) await logout()
}
</script>

<template>
  <aside
    class="fixed inset-y-0 start-0 z-30 w-64 flex-col bg-ink-950 text-white"
    aria-label="القائمة الرئيسية"
  >
    <div class="px-5 pt-6 pb-5">
      <NuxtLink to="/" class="inline-flex rounded-lg" aria-label="الجدول — الصفحة الرئيسية">
        <BrandMark :size="52" light />
      </NuxtLink>
    </div>

    <div v-if="can('bookings.create')" class="px-4 pb-4">
      <AppButton to="/bookings/new" variant="gold" block icon="plus">حجز جديد</AppButton>
    </div>

    <nav class="flex-1 overflow-y-auto px-3">
      <ul class="flex flex-col gap-1">
        <li v-for="item in items" :key="item.key">
          <NuxtLink
            :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined"
            :class="
              cn(
                'flex h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors',
                isActive(item)
                  ? 'bg-white/10 text-gold-300'
                  : 'text-ink-300 hover:bg-white/5 hover:text-white',
              )
            "
          >
            <AppIcon :name="item.icon" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div v-if="user" class="border-t border-white/10 p-3">
      <NuxtLink
        to="/account"
        class="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5"
      >
        <span
          class="grid size-10 shrink-0 place-items-center rounded-full bg-gold-300 font-bold text-ink-950"
        >
          {{ initials(user.name) }}
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate font-semibold">{{ user.name }}</span>
          <span class="truncate text-xs text-ink-400">{{ user.role.label }}</span>
        </span>
      </NuxtLink>
      <button
        type="button"
        class="mt-1 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
        @click="onLogout"
      >
        <AppIcon name="logout" :size="18" />
        تسجيل الخروج
      </button>
    </div>
  </aside>
</template>
