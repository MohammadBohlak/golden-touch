<script setup lang="ts">
withDefaults(defineProps<{ size?: number; withText?: boolean; light?: boolean }>(), {
  size: 40,
  withText: true,
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <img
      src="/logo.webp"
      alt="Golden Touch"
      :width="size"
      :height="Math.round(size * 0.8)"
      class="shrink-0 object-contain"
      :style="{ width: `${size}px`, height: `${Math.round(size * 0.8)}px` }"
    />
    <span v-if="withText" class="flex flex-col leading-tight">
      <span
        :class="['text-[15px] font-extrabold tracking-wide', light ? 'text-gold-300' : 'text-fg']"
        dir="ltr"
      >
        Golden Touch
      </span>
      <span :class="['text-xs font-semibold', light ? 'text-ink-300' : 'text-brand-ink']"
        >اللمسة الذهبية</span
      >
    </span>
  </span>
</template>
