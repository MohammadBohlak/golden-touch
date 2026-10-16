<script setup lang="ts">
import { DIRECTIONAL_ICONS, ICONS, type IconName } from '~/utils/icons'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number | string
    strokeWidth?: number
    /** نص بديل — بدونه تُعتبر الأيقونة زخرفية */
    label?: string
  }>(),
  { size: 20, strokeWidth: 2, label: undefined },
)

const markup = computed(() => ICONS[props.name])
const flip = computed(() => DIRECTIONAL_ICONS.has(props.name))
</script>

<!-- eslint-disable vue/no-v-html -- أيقونات ثابتة معرّفة داخلياً وليست مدخلات مستخدم -->
<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="['shrink-0', flip && 'rtl:-scale-x-100']"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
    v-html="markup"
  />
</template>
