<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  title: string
  subtitle?: string
  /** رابط الرجوع (يظهر سهم رجوع) */
  back?: RouteLocationRaw
}>()
</script>

<template>
  <div class="mb-5 flex items-start gap-3">
    <AppButton
      v-if="back"
      :to="back"
      variant="secondary"
      size="icon"
      icon="chevron-left"
      class="shrink-0"
      aria-label="رجوع"
    />
    <div class="min-w-0 flex-1">
      <!-- تبدّل العنوان (مثلاً من «ملف الزبون» إلى اسمه عند وصول البيانات) بتلاشٍ لا باستبدال فجائي -->
      <Transition name="fade" mode="out-in">
        <h1 :key="title" class="text-2xl leading-tight font-extrabold text-balance lg:text-3xl">
          {{ title }}
        </h1>
      </Transition>
      <ExpandTransition>
        <p v-if="subtitle" class="mt-1 text-[15px] text-fg-muted">{{ subtitle }}</p>
      </ExpandTransition>
    </div>
    <Transition name="fade">
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </Transition>
  </div>
</template>
