import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { STAFF_PERMISSIONS } from '../../prisma/permissions'
import { AuthController } from '../modules/auth/auth.controller'
import { BookingsController } from '../modules/bookings/bookings.controller'
import { CustomersController } from '../modules/customers/customers.controller'
import { HealthController } from '../modules/health/health.controller'
import { PushController } from '../modules/push/push.controller'
import { RecurringController } from '../modules/recurring/recurring.controller'
import { RolesController } from '../modules/roles/roles.controller'
import { ServicesController } from '../modules/services/services.controller'
import { SettingsController } from '../modules/settings/settings.controller'
import { StatsController } from '../modules/stats/stats.controller'
import { UsersController } from '../modules/users/users.controller'
import { IS_PUBLIC_KEY } from './decorators/public.decorator'
import { PERMISSIONS_KEY } from './decorators/permissions.decorator'

/**
 * «سطح الـ API» لمشرف الحجوزات: نستخرج كل المسارات من المتحكّمات فعلياً ونثبّت بالضبط
 * ما يستطيع الوصول إليه. إضافة مسار جديد بلا @RequirePermissions (يفتح للجميع) أو بصلاحية
 * يملكها المشرف تُفشل هذا الاختبار فيُراجَع القرار صراحةً — docs/STAFF_RESTRICTIONS_PLAN.md.
 */
const CONTROLLERS = [
  AuthController,
  HealthController,
  UsersController,
  RolesController,
  SettingsController,
  ServicesController,
  CustomersController,
  BookingsController,
  RecurringController,
  PushController,
  StatsController,
]

interface RouteInfo {
  route: string
  permissions: string[]
  isPublic: boolean
}

function routesOf(controller: new (...args: never[]) => unknown): RouteInfo[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string
  const classPermissions = (Reflect.getMetadata(PERMISSIONS_KEY, controller) as string[]) ?? []
  const routes: RouteInfo[] = []
  for (const name of Object.getOwnPropertyNames(controller.prototype)) {
    if (name === 'constructor') continue
    const handler = (controller.prototype as Record<string, unknown>)[name] as object
    const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined
    if (path === undefined || method === undefined) continue
    routes.push({
      route: `${RequestMethod[method]} /${[base, path === '/' ? '' : path].filter(Boolean).join('/')}`,
      permissions: (Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[]) ?? classPermissions,
      isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
    })
  }
  return routes
}

const ALL = CONTROLLERS.flatMap((c) => routesOf(c as never))
const staffCan = (r: RouteInfo) =>
  r.isPublic || r.permissions.every((p) => STAFF_PERMISSIONS.includes(p))

describe('سطح الـ API للمشرف', () => {
  it('استخراج المسارات يعمل (حارس ضد فراغ صامت)', () => {
    expect(ALL.length).toBeGreaterThan(30)
  })

  it('المسارات المفتوحة بلا تسجيل دخول معروفة ومحدودة', () => {
    expect(
      ALL.filter((r) => r.isPublic)
        .map((r) => r.route)
        .sort(),
    ).toEqual(['GET /health', 'POST /auth/login', 'POST /auth/logout'])
  })

  it('لا مسار محميّ بلا صلاحية إلا حسابي (me / كلمة المرور)', () => {
    expect(
      ALL.filter((r) => !r.isPublic && r.permissions.length === 0)
        .map((r) => r.route)
        .sort(),
    ).toEqual(['GET /auth/me', 'PATCH /auth/me/password'])
  })

  it('المسارات المحمية التي يصل إليها المشرف — بالضبط', () => {
    expect(
      ALL.filter((r) => !r.isPublic && staffCan(r))
        .map((r) => r.route)
        .sort(),
    ).toEqual(
      [
        'GET /auth/me',
        'PATCH /auth/me/password',
        'GET /bookings/day',
        'GET /bookings/availability',
        'GET /bookings/overdue',
        'GET /bookings',
        'GET /bookings/:id',
        'POST /bookings',
        'PATCH /bookings/:id',
        'POST /bookings/:id/complete',
        'POST /bookings/:id/cancel',
        'POST /bookings/:id/reopen',
        'GET /recurring-bookings',
        'GET /recurring-bookings/:id',
        'POST /recurring-bookings/preview',
        'POST /recurring-bookings',
        'PATCH /recurring-bookings/:id',
        'POST /recurring-bookings/:id/stop',
        'GET /customers',
        'GET /customers/:id',
        'POST /customers',
        'GET /push/public-key',
        'POST /push/subscriptions',
        'DELETE /push/subscriptions',
        'POST /push/test',
        'GET /services',
        'GET /services/:id',
        'GET /settings',
      ].sort(),
    )
  })

  it('المحجوب عن المشرف: الإحصائيات والمستخدمون والأدوار وتعديل الخدمات والإعدادات والحذف', () => {
    const blocked = ALL.filter((r) => !staffCan(r)).map((r) => r.route)
    for (const route of [
      'GET /stats',
      'GET /users',
      'POST /users',
      'GET /roles',
      'GET /roles/permissions',
      'POST /services',
      'PATCH /services/:id',
      'DELETE /services/:id',
      'PATCH /settings',
      'DELETE /bookings/:id',
      'DELETE /customers/:id',
      'PATCH /customers/:id',
    ]) {
      expect(blocked).toContain(route)
    }
  })
})
