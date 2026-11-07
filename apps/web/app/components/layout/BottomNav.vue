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

// مؤشر التحديد ينزلق خلف أيقونة التبويب النشط (يشمل «المزيد») بدل الظهور الفجائي
const track = ref<HTMLElement>()
const indicator = useSlidingIndicator(track, '[aria-current="page"] [data-pill]', () => [
  route.path,
  items.value.length,
])
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 safe-bottom backdrop-blur"
    aria-label="التنقل الرئيسي"
  >
    <div ref="track" class="relative mx-auto max-w-lg">
      <!-- left/top: صفر فيزيائياً عمداً — الإزاحة تُقاس من الحافة اليسرى للحاوية في RTL أيضاً -->
      <span
        v-show="indicator.ready.value"
        aria-hidden="true"
        style="left: 0; top: 0"
        :class="
          cn(
            'pointer-events-none absolute z-0 rounded-full bg-gold-100',
            indicator.motionClass.value,
          )
        "
        :style="indicator.style.value"
      />
      <ul class="flex h-16 items-stretch px-1">
        <li v-for="item in left" :key="item.key" class="flex-1">
          <NavTab :item="item" :active="isActive(item)" :static-pill="!indicator.ready.value" />
        </li>

        <li
          v-if="can('bookings.create')"
          class="relative z-10 flex flex-1 items-start justify-center"
        >
          <NuxtLink
            to="/bookings/new"
            class="group -mt-5 flex flex-col items-center gap-1"
            aria-label="حجز جديد"
          >
            <span
              class="grid size-14 place-items-center rounded-2xl bg-gold-300 text-ink-950 shadow-gold ring-4 ring-canvas transition-transform duration-(--motion-fast) ease-out-soft active:scale-95"
            >
              <AppIcon
                name="plus"
                :size="26"
                :stroke-width="2.5"
                class="transition-transform duration-(--motion-base) ease-spring group-active:rotate-90"
              />
            </span>
            <span class="text-[11px] font-bold text-fg">حجز</span>
          </NuxtLink>
        </li>

        <li v-for="item in right" :key="item.key" class="flex-1">
          <NavTab :item="item" :active="isActive(item)" :static-pill="!indicator.ready.value" />
        </li>
        <li class="flex-1">
          <NavTab :item="more" :active="moreActive" :static-pill="!indicator.ready.value" />
        </li>
      </ul>
    </div>
  </nav>
</template>
