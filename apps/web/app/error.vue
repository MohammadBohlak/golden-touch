<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: notFound.value ? 'الصفحة غير موجودة' : 'حدث خطأ' })
</script>

<template>
  <main
    class="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-6 text-center"
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
    <AppButton icon="calendar" @click="clearError({ redirect: '/' })">العودة إلى الجدول</AppButton>
  </main>
</template>
