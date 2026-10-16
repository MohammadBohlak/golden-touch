<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 18 })
</script>

<template>
  <AppIcon name="loader" :size="size" class="animate-spin" />
</template>
