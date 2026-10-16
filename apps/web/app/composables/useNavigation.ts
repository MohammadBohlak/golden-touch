import { isNavActive, NAVIGATION, type NavPlacement } from '~/config/navigation'

/** عناصر القائمة المصفّاة بالصلاحيات لموضع معيّن */
export function useNavigation(placement: NavPlacement) {
  const { has } = usePermission()
  const route = useRoute()

  const items = computed(() =>
    NAVIGATION.filter((item) => item.placement.includes(placement) && has(item.permission)),
  )

  return {
    items,
    isActive: (item: (typeof NAVIGATION)[number]) => isNavActive(item, route.path),
  }
}
