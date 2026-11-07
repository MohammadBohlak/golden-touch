<script setup lang="ts">
/** زر إظهار/إخفاء كلمة المرور داخل خانة #end في AppInput؛ الأيقونة تتبدّل بنقرة صغيرة متحركة */
const shown = defineModel<boolean>({ default: false })
</script>

<template>
  <button
    type="button"
    class="grid size-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted"
    :aria-label="shown ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'"
    :aria-pressed="shown"
    @click="shown = !shown"
  >
    <Transition name="pop" mode="out-in">
      <AppIcon :key="shown ? 'off' : 'on'" :name="shown ? 'eye-off' : 'eye'" :size="18" />
    </Transition>
  </button>
</template>
