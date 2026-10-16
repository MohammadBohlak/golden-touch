<script setup lang="ts">
const route = useRoute()
const settings = useSettingsStore()

// الإعدادات (المنطقة الزمنية + الدوام) تلزم كل الصفحات — تُحمّل مرة واحدة
onMounted(() => {
  settings.ensure().catch(() => {})
})

useHead({ title: () => (route.meta.title as string | undefined) ?? 'الجدول' })
</script>

<template>
  <div class="min-h-dvh lg:ps-64">
    <a
      href="#main"
      class="sr-only z-[70] rounded-lg bg-ink-950 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
    >
      تخطَّ إلى المحتوى
    </a>

    <AppSidebar class="hidden lg:flex" />
    <AppHeader class="lg:hidden" />

    <main
      id="main"
      tabindex="-1"
      class="mx-auto w-full max-w-5xl px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] outline-none lg:px-8 lg:pt-8 lg:pb-12"
    >
      <slot />
    </main>

    <BottomNav class="lg:hidden" />
    <ToastViewport />
    <ConfirmDialog />
  </div>
</template>
