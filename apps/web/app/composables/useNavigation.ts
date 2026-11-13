import { isNavActive, navigationFor, type NavItem, type NavPlacement } from '~/config/navigation'

/** عناصر القائمة المصفّاة بالصلاحيات لموضع معيّن */
export function useNavigation(placement: NavPlacement) {
  const { has } = usePermission()
  const route = useRoute()

  const items = computed(() => navigationFor(placement, has))

  return {
    items,
    isActive: (item: NavItem) => isNavActive(item, route.path),
  }
}
