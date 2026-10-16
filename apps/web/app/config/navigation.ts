import type { IconName } from '~/utils/icons'

export type NavPlacement = 'sidebar' | 'bottom' | 'more'

export interface NavItem {
  key: string
  label: string
  description?: string
  icon: IconName
  to: string
  /** يكفي امتلاك واحدة */
  permission?: string | string[]
  placement: NavPlacement[]
  /** مطابقة تامة للمسار (للرئيسية) */
  exact?: boolean
  /** مسارات فرعية لا تُعتبر ضمن هذا العنصر */
  exclude?: string[]
}

/** مصدر واحد لكل القوائم: الشريط الجانبي (سطح المكتب)، الشريط السفلي، وصفحة "المزيد" (الموبايل) */
export const NAVIGATION: NavItem[] = [
  {
    key: 'schedule',
    label: 'الجدول',
    icon: 'calendar',
    to: '/',
    permission: 'bookings.read',
    placement: ['sidebar', 'bottom'],
    exact: true,
  },
  {
    key: 'bookings',
    label: 'الحجوزات',
    icon: 'list',
    to: '/bookings',
    permission: 'bookings.read',
    placement: ['sidebar', 'bottom'],
    exclude: ['/bookings/new'],
  },
  {
    key: 'stats',
    label: 'الإحصائيات',
    icon: 'chart',
    to: '/stats',
    permission: 'stats.read',
    placement: ['sidebar', 'bottom'],
  },
  {
    key: 'customers',
    label: 'الزبائن',
    description: 'سجل الزبائن وزياراتهم',
    icon: 'users',
    to: '/customers',
    permission: 'customers.read',
    placement: ['sidebar', 'more'],
  },
  {
    key: 'services',
    label: 'الخدمات والأسعار',
    description: 'الخدمات ومدتها وسعرها',
    icon: 'scissors',
    to: '/services',
    permission: 'services.read',
    placement: ['sidebar', 'more'],
  },
  {
    key: 'users',
    label: 'المستخدمون',
    description: 'حسابات فريق العمل وصلاحياتهم',
    icon: 'shield',
    to: '/users',
    permission: 'users.read',
    placement: ['sidebar', 'more'],
  },
  {
    key: 'settings',
    label: 'إعدادات الصالون',
    description: 'ساعات الدوام وأيام العطلة',
    icon: 'sliders',
    to: '/settings',
    permission: 'settings.update',
    placement: ['sidebar', 'more'],
  },
  {
    key: 'account',
    label: 'حسابي',
    description: 'بياناتك وتغيير كلمة المرور',
    icon: 'key',
    to: '/account',
    placement: ['more'],
  },
]

export function isNavActive(item: NavItem, path: string): boolean {
  if (item.exclude?.includes(path)) return false
  return item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`)
}
