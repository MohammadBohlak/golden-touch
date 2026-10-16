<script setup lang="ts">
useHead({
  bodyAttrs: { class: 'bg-canvas' },
})
</script>

<template>
  <NuxtLoadingIndicator color="#E3C177" :height="3" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
