<script setup lang="ts">
/**
 * تأكيد الخروج من التطبيق عند الرجوع من أول صفحة (انظر utils/back-stack.ts).
 * يُركَّب مرة واحدة في app.vue (وفي error.vue)؛ الفتح من plugins/00.back-navigation.client.ts.
 */
const open = useState('exit-prompt', () => false)

function stay() {
  open.value = false
}

function leave() {
  // قبل الإغلاق: المكتبة تحتسب مدخل هذا الحوار في السجل ضمن رحلة الخروج
  leaveApp()
  open.value = false
}
</script>

<template>
  <AppModal v-model:open="open" title="إغلاق التطبيق" size="sm">
    <p class="leading-relaxed text-fg-muted">سيتم إغلاق التطبيق. هل تريد المتابعة؟</p>
    <template #footer>
      <AppButton variant="secondary" data-autofocus @click="stay">البقاء</AppButton>
      <AppButton @click="leave">إغلاق التطبيق</AppButton>
    </template>
  </AppModal>
</template>
