import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'
// مصدر الحقيقة الوحيد لصلاحيات الأدوار (يستعمله الـ seed واختبارات الـ API أيضاً)
import { PERMISSIONS, STAFF_PERMISSIONS } from '../../api/prisma/permissions.ts'
import { NAVIGATION, navigationFor } from '../app/config/navigation.ts'
import { hasAnyPermission } from '../app/utils/permissions.ts'

const ALL_PERMISSIONS = PERMISSIONS.map(([key]) => key)
const hasFor = (granted: string[]) => (p: string | string[] | undefined) =>
  hasAnyPermission(granted, p)
const keys = (granted: string[], placement: 'sidebar' | 'bottom' | 'more') =>
  navigationFor(placement, hasFor(granted)).map((i) => i.key)

describe('hasAnyPermission', () => {
  it('يكفي امتلاك واحدة، والفارغ متاح للجميع', () => {
    assert.equal(hasAnyPermission(['a'], undefined), true)
    assert.equal(hasAnyPermission([], []), true)
    assert.equal(hasAnyPermission(['a'], 'a'), true)
    assert.equal(hasAnyPermission(['a'], ['b', 'a']), true)
    assert.equal(hasAnyPermission(['a'], 'b'), false)
    assert.equal(hasAnyPermission([], 'a'), false)
  })
})

describe('قوائم التنقل حسب الدور', () => {
  it('المدير يرى كل شيء', () => {
    assert.deepEqual(keys(ALL_PERMISSIONS, 'sidebar'), [
      'schedule',
      'bookings',
      'stats',
      'customers',
      'recurring',
      'services',
      'users',
      'settings',
    ])
    assert.deepEqual(keys(ALL_PERMISSIONS, 'bottom'), ['schedule', 'bookings', 'stats'])
    assert.deepEqual(keys(ALL_PERMISSIONS, 'more'), [
      'customers',
      'recurring',
      'services',
      'users',
      'settings',
      'account',
    ])
  })

  it('المشرف: الجدول والحجوزات والزبائن والحجوزات الدورية وحسابي — لا إحصائيات ولا خدمات', () => {
    assert.deepEqual(keys(STAFF_PERMISSIONS, 'sidebar'), [
      'schedule',
      'bookings',
      'customers',
      'recurring',
    ])
    assert.deepEqual(keys(STAFF_PERMISSIONS, 'bottom'), ['schedule', 'bookings'])
    assert.deepEqual(keys(STAFF_PERMISSIONS, 'more'), ['customers', 'recurring', 'account'])
  })

  it('المشرف لا يرى زر الإحصائيات ولا الخدمات في أي موضع', () => {
    for (const placement of ['sidebar', 'bottom', 'more'] as const) {
      const visible = keys(STAFF_PERMISSIONS, placement)
      assert.ok(!visible.includes('stats'), `stats في ${placement}`)
      assert.ok(!visible.includes('services'), `services في ${placement}`)
    }
  })
})

/** صفحات التطبيق: المسار ← الصلاحية المعلنة في definePageMeta (إن وُجدت) */
function pagePermissions(): Map<string, string | undefined> {
  const root = new URL('../app/pages', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  const result = new Map<string, string | undefined>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.vue')) {
        const rel = relative(root, full)
          .replaceAll('\\', '/')
          .replace(/\.vue$/, '')
        const route = '/' + rel.replace(/(^|\/)index$/, '')
        const meta = readFileSync(full, 'utf8').match(/definePageMeta\(\{[^}]*\}\)/)?.[0]
        result.set(
          route === '/' ? '/' : route.replace(/\/$/, ''),
          meta?.match(/permission:\s*'([^']+)'/)?.[1],
        )
      }
    }
  }
  walk(root)
  return result
}

describe('صفحات التطبيق والصلاحيات', () => {
  const pages = pagePermissions()

  it('استخراج الصفحات يعمل', () => {
    assert.ok(pages.size >= 10, `وُجدت ${pages.size} صفحة فقط`)
  })

  it('الصفحات التي تُحجب عن المشرف بالضبط', () => {
    const blocked = [...pages]
      .filter(([, permission]) => !hasAnyPermission(STAFF_PERMISSIONS, permission))
      .map(([route]) => route)
      .sort()
    // /push-lab: صفحة تجربة مؤقتة (المرحلة 0 من docs/PUSH_NOTIFICATIONS_PLAN.md) — تُحذف مع المرحلة 1
    assert.deepEqual(blocked, ['/push-lab', '/services', '/settings', '/stats', '/users'])
  })

  it('صلاحية كل عنصر قائمة = صلاحية صفحته (لا صفحة مفتوحة وزرّها مخفي)', () => {
    for (const item of NAVIGATION) {
      assert.ok(pages.has(item.to), `لا صفحة للمسار ${item.to}`)
      assert.equal(
        pages.get(item.to),
        item.permission as string | undefined,
        `عدم اتساق في ${item.to}`,
      )
    }
  })
})
