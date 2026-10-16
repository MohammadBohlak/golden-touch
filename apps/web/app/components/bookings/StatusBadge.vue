<script setup lang="ts">
import type { BookingStatus } from '~/types/api'

const props = defineProps<{ status: BookingStatus }>()
const meta = computed(() => STATUS_META[props.status])
</script>

<template>
  <AppBadge :tone="meta.tone" :icon="meta.icon">{{ meta.label }}</AppBadge>
</template>
