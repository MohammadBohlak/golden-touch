<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
const leaving = ref(false)

useHead({ title: notFound.value ? 'الصفحة غير موجودة' : 'حدث خطأ' })

/** تتلاشى الصفحة أولاً ثم نعود للجدول، بدل اختفائها فجأة */
async function goHome() {
  if (!prefersReducedMotion()) {
    leaving.value = true
    await new Promise((resolve) => setTimeout(resolve, exitDuration(MOTION.base)))
  }
  await clearError({ redirect: '/' })
}
</script>

<template>
  <main
    :class="
      cn(
        'flex min-h-dvh animate-rise-in flex-col items-center justify-center gap-5 bg-canvas px-6 text-center transition-opacity duration-(--motion-base-exit) ease-in-soft',
        leaving && 'opacity-0',
      )
    "
  >
    <img src="/logo.webp" alt="Golden Touch" width="120" height="96" class="h-auto w-30" />
    <div>
      <p class="text-5xl font-extrabold text-gold-600 tabular-nums">{{ error.statusCode }}</p>
      <h1 class="mt-2 text-xl font-extrabold">
        {{ notFound ? 'الصفحة غير موجودة' : 'حدث خطأ غير متوقع' }}
      </h1>
      <p class="mt-1 text-fg-muted">
        {{ notFound ? 'ربما تغيّر الرابط أو حُذفت الصفحة.' : 'حاول مجدداً بعد قليل.' }}
      </p>
    </div>
    <AppButton icon="calendar" :disabled="leaving" @click="goHome">العودة إلى الجدول</AppButton>
  </main>
  <ExitConfirmDialog />
</template>
