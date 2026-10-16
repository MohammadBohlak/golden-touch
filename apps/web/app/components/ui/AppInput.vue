<script setup lang="ts">
import type { IconName } from '~/utils/icons'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    type?: string
    invalid?: boolean
    icon?: IconName
    /** اتجاه النص (مثلاً ltr لأرقام الهاتف والبريد) */
    dir?: 'ltr' | 'rtl' | 'auto'
    inputClass?: string
  }>(),
  { type: 'text', icon: undefined, dir: undefined, inputClass: undefined },
)

const model = defineModel<string | number | null | undefined>()
const attrs = useAttrs()
const input = ref<HTMLInputElement>()

const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <!-- الاتجاه على الغلاف حتى تتطابق مواضع الأيقونة/اللاحقة مع حشوة الحقل (الخصائص المنطقية) -->
  <div :dir="dir" :class="cn('relative', attrs.class as string)">
    <AppIcon
      v-if="icon"
      :name="icon"
      :size="18"
      class="pointer-events-none absolute inset-y-0 start-3.5 my-auto text-fg-subtle"
    />
    <input
      ref="input"
      v-model="model"
      :type="props.type"
      :aria-invalid="invalid || undefined"
      v-bind="inputAttrs"
      :class="
        cn(
          'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg transition-colors',
          'placeholder:text-fg-subtle',
          'focus:border-gold-500 focus:ring-2 focus:ring-gold-200 focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-muted',
          invalid ? 'border-danger focus:border-danger focus:ring-red-100' : 'border-line-strong',
          icon && 'ps-10',
          $slots.end && 'pe-12',
          inputClass,
        )
      "
    />
    <div v-if="$slots.end" class="absolute inset-y-0 end-1 flex items-center">
      <slot name="end" />
    </div>
  </div>
</template>
