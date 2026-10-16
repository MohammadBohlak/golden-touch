<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-white/5 bg-ink-950 safe-top text-white">
    <div class="flex h-14 items-center justify-between gap-3 px-4">
      <NuxtLink to="/" class="rounded-lg" aria-label="الجدول — الصفحة الرئيسية">
        <BrandMark :size="38" light />
      </NuxtLink>
      <NuxtLink
        v-if="user"
        to="/more"
        class="flex items-center gap-2 rounded-full py-1 ps-3 pe-1 text-sm font-semibold text-ink-200 hover:bg-white/5"
        :aria-label="`حساب ${user.name} — المزيد`"
      >
        <span class="max-w-28 truncate">{{ user.name }}</span>
        <span
          class="grid size-9 place-items-center rounded-full bg-gold-300 font-bold text-ink-950"
        >
          {{ initials(user.name) }}
        </span>
      </NuxtLink>
    </div>
  </header>
</template>
