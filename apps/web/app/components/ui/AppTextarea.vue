<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ invalid?: boolean }>()
const model = defineModel<string | null | undefined>()
const attrs = useAttrs()
const rest = computed(() => {
  const { class: _class, ...others } = attrs
  return others
})
</script>

<template>
  <textarea
    v-model="model"
    rows="3"
    :aria-invalid="invalid || undefined"
    v-bind="rest"
    :class="
      cn(
        'w-full resize-y rounded-xl border bg-surface px-3.5 py-3 text-base leading-relaxed text-fg',
        'placeholder:text-fg-subtle focus:border-gold-500 focus:ring-2 focus:ring-gold-200 focus:outline-none',
        invalid ? 'border-danger' : 'border-line-strong',
        attrs.class as string,
      )
    "
  />
</template>
