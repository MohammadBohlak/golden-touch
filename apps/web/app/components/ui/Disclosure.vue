<script setup lang="ts">
/**
 * قسم قابل للطيّ بحركة (بديل `<details>` الذي لا يمكن تحريكه): زر ترويسة + Collapse.
 * يحافظ على الإتاحة: aria-expanded/aria-controls، والمحتوى المغلق معطّل عن التركيز.
 *
 *   <Disclosure v-model:open="open">
 *     <template #summary><AppIcon name="note" /> عنوان</template>
 *     …المحتوى
 *   </Disclosure>
 */
const open = defineModel<boolean>('open', { default: false })
const id = useId()
</script>

<template>
  <div class="rounded-2xl border border-line bg-surface">
    <button
      type="button"
      class="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-start"
      :aria-expanded="open"
      :aria-controls="id"
      @click="open = !open"
    >
      <span class="flex items-center gap-2"><slot name="summary" /></span>
      <AppIcon
        name="chevron-down"
        :size="18"
        :class="
          cn(
            'shrink-0 transition-transform duration-(--motion-base) ease-out-soft',
            open && 'rotate-180',
          )
        "
      />
    </button>
    <Collapse :id="id" :open="open">
      <div class="px-4 pb-4"><slot /></div>
    </Collapse>
  </div>
</template>
