<script setup lang="ts">
import type { NavItem } from '~/config/navigation'

defineProps<{ item: NavItem; active: boolean }>()
</script>

<template>
  <NuxtLink
    :to="item.to"
    :aria-current="active ? 'page' : undefined"
    :class="
      cn(
        'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors',
        active ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
      )
    "
  >
    <span
      :class="
        cn(
          'grid h-7 w-12 place-items-center rounded-full transition-colors',
          active && 'bg-gold-100 text-gold-800',
        )
      "
    >
      <AppIcon :name="item.icon" :size="20" :stroke-width="active ? 2.4 : 2" />
    </span>
    {{ item.label }}
  </NuxtLink>
</template>
