<script setup lang="ts">
/** حقل مبلغ بالليرة: لوحة أرقام على الموبايل، يقبل الأرقام العربية، ويعرض الصيغة المقروءة */
defineOptions({ inheritAttrs: false })
defineProps<{ invalid?: boolean }>()

const model = defineModel<number | null | undefined>()
const text = ref(model.value == null ? '' : String(model.value))

watch(model, (value) => {
  if (parseInteger(text.value) !== value) text.value = value == null ? '' : String(value)
})

function onInput(value: string | number | null | undefined) {
  const parsed = parseInteger(value)
  text.value = parsed == null ? '' : String(parsed)
  model.value = parsed
}
</script>

<template>
  <AppInput
    v-bind="$attrs"
    :model-value="text"
    type="text"
    inputmode="numeric"
    dir="ltr"
    autocomplete="off"
    :invalid="invalid"
    input-class="pe-16 text-lg font-bold tabular-nums"
    @update:model-value="onInput"
  >
    <template #end>
      <span class="pe-3 text-sm font-semibold text-fg-muted">ل.س</span>
    </template>
  </AppInput>
</template>
