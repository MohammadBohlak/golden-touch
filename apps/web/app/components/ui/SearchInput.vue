<script setup lang="ts">
withDefaults(defineProps<{ placeholder?: string; label?: string }>(), {
  placeholder: 'بحث…',
  label: 'بحث',
})
const model = defineModel<string>({ default: '' })
</script>

<template>
  <AppInput
    v-model="model"
    type="search"
    icon="search"
    :placeholder="placeholder"
    :aria-label="label"
    enterkeyhint="search"
    autocomplete="off"
  >
    <template v-if="model" #end>
      <button
        type="button"
        class="grid size-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted"
        aria-label="مسح البحث"
        @click="model = ''"
      >
        <AppIcon name="x" :size="16" />
      </button>
    </template>
  </AppInput>
</template>
