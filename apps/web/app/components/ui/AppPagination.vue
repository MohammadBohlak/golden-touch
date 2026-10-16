<script setup lang="ts">
const props = defineProps<{ total: number; limit: number; disabled?: boolean }>()
const page = defineModel<number>({ required: true })
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)))
</script>

<template>
  <nav v-if="pages > 1" aria-label="ترقيم الصفحات" class="flex items-center justify-between gap-3">
    <AppButton
      variant="secondary"
      size="sm"
      icon="chevron-left"
      :disabled="disabled || page <= 1"
      @click="page -= 1"
    >
      السابق
    </AppButton>
    <p class="text-sm text-fg-muted tabular-nums">
      صفحة <strong class="text-fg">{{ page }}</strong> من {{ pages }}
    </p>
    <AppButton
      variant="secondary"
      size="sm"
      icon-end="chevron-right"
      :disabled="disabled || page >= pages"
      @click="page += 1"
    >
      التالي
    </AppButton>
  </nav>
</template>
