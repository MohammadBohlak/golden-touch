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
      <h1 class="text-2xl leading-tight font-extrabold text-balance lg:text-3xl">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-[15px] text-fg-muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
