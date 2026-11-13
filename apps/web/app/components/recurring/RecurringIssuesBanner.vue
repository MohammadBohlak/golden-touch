<script setup lang="ts">
/**
 * تنبيه في أعلى الجدول: مواعيد دورية تعذّر إنشاؤها (تعارض، عطلة، خدمة غير متاحة…).
 * لا يظهر إلا إن وُجدت مشكلة، ويقود إلى صفحة الحجوزات الدورية لمعالجتها.
 */
defineProps<{ count: number }>()
</script>

<template>
  <ExpandTransition>
    <NuxtLink
      v-if="count > 0"
      to="/recurring"
      class="flex items-center gap-3 rounded-3xl border border-amber-200 bg-warning-soft p-4 transition-shadow hover:shadow-card"
    >
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-warning">
        <AppIcon name="repeat" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block font-extrabold text-amber-950"
          >{{ issuesTitle(count) }} من الحجوزات الدورية</span
        >
        <span class="block text-sm text-amber-900">راجعها حتى لا يفقد زبون ثابت موعده.</span>
      </span>
      <span class="text-sm font-bold text-amber-900">مراجعة</span>
      <AppIcon name="chevron-right" :size="16" class="shrink-0 text-amber-900" />
    </NuxtLink>
  </ExpandTransition>
</template>
