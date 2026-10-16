<script setup lang="ts">
const route = useRoute()
useHead({ title: () => (route.meta.title as string | undefined) ?? 'تسجيل الدخول' })
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas">
    <div
      class="relative overflow-hidden bg-ink-950 px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-20 text-center text-white"
    >
      <!-- خطوط ذهبية زخرفية مستوحاة من إطار اللوغو -->
      <div
        class="pointer-events-none absolute inset-x-0 bottom-6 mx-auto h-px max-w-xs bg-linear-to-l from-transparent via-gold-300/70 to-transparent"
        aria-hidden="true"
      />
      <img
        src="/logo.webp"
        alt="شعار Golden Touch"
        width="176"
        height="142"
        class="mx-auto h-auto w-44 drop-shadow-[0_10px_30px_rgba(227,193,119,0.25)]"
      />
      <p class="mt-4 text-2xl font-extrabold tracking-wide text-gold-300" dir="ltr">Golden Touch</p>
      <p class="mt-1 text-sm text-ink-300">اللمسة الذهبية · إدارة المواعيد</p>
    </div>

    <main id="main" class="relative z-10 -mt-12 flex flex-1 justify-center px-4 pb-10">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </main>
    <ToastViewport />
  </div>
</template>
