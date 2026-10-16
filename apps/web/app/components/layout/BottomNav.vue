<script setup lang="ts">
import type { NavItem } from '~/config/navigation'

/** شريط سفلي للموبايل: 4 وجهات + زر حجز مركزي بارز */
const { items, isActive } = useNavigation('bottom')
const { can } = useAuth()
const route = useRoute()

const more: NavItem = {
  key: 'more',
  label: 'المزيد',
  icon: 'grid',
  to: '/more',
  placement: ['bottom'],
}
const moreActive = computed(
  () =>
    route.path === '/more' ||
    ['/customers', '/services', '/users', '/settings', '/account'].some((p) =>
      route.path.startsWith(p),
    ),
)

const left = computed(() => items.value.slice(0, 2))
const right = computed(() => items.value.slice(2))
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 safe-bottom backdrop-blur"
    aria-label="التنقل الرئيسي"
  >
    <ul class="mx-auto flex h-16 max-w-lg items-stretch px-1">
      <li v-for="item in left" :key="item.key" class="flex-1">
        <NavTab :item="item" :active="isActive(item)" />
      </li>

      <li v-if="can('bookings.create')" class="flex flex-1 items-start justify-center">
        <NuxtLink
          to="/bookings/new"
          class="-mt-5 flex flex-col items-center gap-1"
          aria-label="حجز جديد"
        >
          <span
            class="grid size-14 place-items-center rounded-2xl bg-gold-300 text-ink-950 shadow-gold ring-4 ring-canvas transition-transform active:scale-95"
          >
            <AppIcon name="plus" :size="26" :stroke-width="2.5" />
          </span>
          <span class="text-[11px] font-bold text-fg">حجز</span>
        </NuxtLink>
      </li>

      <li v-for="item in right" :key="item.key" class="flex-1">
        <NavTab :item="item" :active="isActive(item)" />
      </li>
      <li class="flex-1">
        <NavTab :item="more" :active="moreActive" />
      </li>
    </ul>
  </nav>
</template>
