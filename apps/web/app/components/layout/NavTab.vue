<script setup lang="ts">
import type { NavItem } from '~/config/navigation'

/**
 * `staticPill`: يرسم خلفية التحديد على الأيقونة نفسها (قبل جاهزية المؤشر المنزلق في BottomNav،
 * أي في HTML الخادم) — بعدها يتولى المؤشر المنزلق رسمها.
 */
defineProps<{ item: NavItem; active: boolean; staticPill?: boolean }>()
</script>

<template>
  <NuxtLink
    :to="item.to"
    :aria-current="active ? 'page' : undefined"
    :class="
      cn(
        'relative z-10 flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors',
        active ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
      )
    "
  >
    <span
      data-pill
      :class="
        cn(
          'grid h-7 w-12 place-items-center rounded-full transition-colors',
          active && (staticPill ? 'bg-gold-100 text-gold-800' : 'text-gold-800'),
        )
      "
    >
      <AppIcon :name="item.icon" :size="20" :stroke-width="active ? 2.4 : 2" />
    </span>
    {{ item.label }}
  </NuxtLink>
</template>
