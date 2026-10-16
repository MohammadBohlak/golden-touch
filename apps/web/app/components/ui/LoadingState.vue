<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'list' | 'cards' | 'spinner'
    rows?: number
    label?: string
  }>(),
  { variant: 'list', rows: 4, label: 'جارٍ التحميل…' },
)
</script>

<template>
  <div role="status" :aria-label="label" aria-busy="true">
    <div
      v-if="variant === 'spinner'"
      class="flex items-center justify-center gap-2 py-12 text-fg-muted"
    >
      <AppSpinner />
      <span>{{ label }}</span>
    </div>
    <div v-else-if="variant === 'cards'" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="i in rows" :key="i" class="h-24 skeleton rounded-2xl" />
    </div>
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="i in rows"
        :key="i"
        class="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card"
      >
        <div class="size-11 shrink-0 skeleton rounded-xl" />
        <div class="flex flex-1 flex-col gap-2">
          <div class="h-3.5 w-2/5 skeleton rounded" />
          <div class="h-3 w-3/5 skeleton rounded" />
        </div>
      </div>
    </div>
    <span class="sr-only">{{ label }}</span>
  </div>
</template>
