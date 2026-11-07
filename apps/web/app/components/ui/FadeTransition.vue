<script setup lang="ts">
/**
 * تبديل حالات (تحميل ⇄ محتوى ⇄ خطأ ⇄ فراغ) بتلاشٍ. كل فرع بجذر عنصر واحد ومفتاح `key`
 * وبلا تعليقات HTML بين الفروع:
 *
 *   <FadeTransition>
 *     <LoadingState v-if="loading" key="loading" />
 *     <ErrorState v-else-if="error" key="error" />
 *     <div v-else key="content">…</div>
 *   </FadeTransition>
 */
withDefaults(defineProps<{ mode?: 'out-in' | 'in-out' | 'default' }>(), { mode: 'out-in' })
</script>

<template>
  <Transition name="fade" :mode="mode === 'default' ? undefined : mode">
    <slot />
  </Transition>
</template>
