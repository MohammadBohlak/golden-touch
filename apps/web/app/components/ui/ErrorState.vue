<script setup lang="ts">
withDefaults(defineProps<{ message?: string; retrying?: boolean }>(), {
  message: 'حدث خطأ أثناء تحميل البيانات',
})
defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    role="alert"
    class="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-danger-soft px-5 py-8 text-center"
  >
    <span class="grid size-12 place-items-center rounded-full bg-white text-danger">
      <AppIcon name="alert" :size="24" />
    </span>
    <p class="max-w-sm font-semibold text-red-900">{{ message }}</p>
    <AppButton
      variant="secondary"
      size="sm"
      icon="refresh"
      :loading="retrying"
      @click="$emit('retry')"
    >
      إعادة المحاولة
    </AppButton>
  </div>
</template>
