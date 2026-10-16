<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  options: { value: string | number; label: string }[]
  invalid?: boolean
  placeholder?: string
}>()

const model = defineModel<string | number | null | undefined>()
const attrs = useAttrs()
const rest = computed(() => {
  const { class: _class, ...others } = attrs
  return others
})
</script>

<template>
  <div :class="cn('relative', attrs.class as string)">
    <select
      v-model="model"
      :aria-invalid="invalid || undefined"
      v-bind="rest"
      :class="
        cn(
          'h-12 w-full appearance-none rounded-xl border bg-surface ps-3.5 pe-10 text-base text-fg',
          'focus:border-gold-500 focus:ring-2 focus:ring-gold-200 focus:outline-none',
          invalid ? 'border-danger' : 'border-line-strong',
        )
      "
    >
      <option v-if="placeholder" :value="null" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <AppIcon
      name="chevron-down"
      :size="18"
      class="pointer-events-none absolute inset-y-0 end-3.5 my-auto text-fg-muted"
    />
  </div>
</template>
