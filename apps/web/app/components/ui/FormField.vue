<script setup lang="ts">
import { useField } from 'vee-validate'

/**
 * يربط حقلاً بـ vee-validate ويعرض خطأ yup بعد اللمس (blur) أو بعد محاولة الإرسال.
 * الاستخدام:
 *   <FormField name="email" label="البريد" v-slot="{ field, id, invalid, describedBy }">
 *     <AppInput :id v-bind="field" :invalid :aria-describedby="describedBy" />
 *   </FormField>
 */
const props = withDefaults(
  defineProps<{
    name: string
    label?: string
    hint?: string
    required?: boolean
    /** إخفاء التسمية بصرياً مع إبقائها لقارئ الشاشة */
    srOnlyLabel?: boolean
  }>(),
  { label: undefined, hint: undefined },
)

const { value, errorMessage, meta, handleBlur, handleChange } = useField<
  string | number | null | undefined
>(() => props.name, undefined, { validateOnValueUpdate: false })

const uid = useId()
const id = computed(() => `field-${props.name}-${uid}`)
const errorId = computed(() => `${id.value}-error`)
const hintId = computed(() => `${id.value}-hint`)
const showError = computed(() => Boolean(errorMessage.value) && (meta.touched || meta.validated))

const field = computed(() => ({
  modelValue: value.value,
  // بعد أول لمس نتحقق مع كل تعديل، قبله ننتظر الخروج من الحقل
  'onUpdate:modelValue': (next: unknown) => handleChange(next, meta.touched),
  onBlur: (event: Event) => handleBlur(event, true),
}))

const describedBy = computed(
  () =>
    [showError.value && errorId.value, props.hint && hintId.value].filter(Boolean).join(' ') ||
    undefined,
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="id"
      :class="cn('text-sm font-semibold text-fg', srOnlyLabel && 'sr-only')"
    >
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <slot v-bind="{ field, id, invalid: showError, describedBy, value }" />
    <p
      v-if="showError"
      :id="errorId"
      role="alert"
      class="flex items-center gap-1 text-sm font-medium text-danger"
    >
      <AppIcon name="alert" :size="14" />
      {{ errorMessage }}
    </p>
    <p v-else-if="hint" :id="hintId" class="text-sm text-fg-muted">{{ hint }}</p>
  </div>
</template>
