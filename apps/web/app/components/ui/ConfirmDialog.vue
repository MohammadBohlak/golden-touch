<script setup lang="ts">
/** مضيف حوار التأكيد العام — يُركَّب مرة واحدة في التخطيط ويُستدعى عبر useConfirm() */
const { state, settle } = useConfirm()

const open = computed({
  get: () => state.value.open,
  set: (value) => {
    if (!value) settle(false)
  },
})
</script>

<template>
  <AppModal v-model:open="open" :title="state.options.title" size="sm">
    <p v-if="state.options.message" class="leading-relaxed text-fg-muted">
      {{ state.options.message }}
    </p>
    <template #footer>
      <AppButton variant="secondary" @click="settle(false)">
        {{ state.options.cancelLabel ?? 'تراجع' }}
      </AppButton>
      <AppButton
        :variant="state.options.tone === 'danger' ? 'danger' : 'primary'"
        data-autofocus
        @click="settle(true)"
      >
        {{ state.options.confirmLabel ?? 'تأكيد' }}
      </AppButton>
    </template>
  </AppModal>
</template>
