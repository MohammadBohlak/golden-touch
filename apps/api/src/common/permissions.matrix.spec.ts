import { PERMISSIONS, STAFF_PERMISSIONS } from '../../prisma/permissions'

/**
 * مصفوفة صلاحيات مشرف الحجوزات (docs/STAFF_RESTRICTIONS_PLAN.md).
 * القائمتان مكتوبتان حرفياً عمداً: أي تغيير في صلاحيات المشرف يجب أن يكون قراراً صريحاً
 * يمرّ بتعديل هذا الاختبار، لا نتيجة جانبية لإضافة صلاحية جديدة.
 */
const ALL_KEYS = PERMISSIONS.map(([key]) => key)

const STAFF_MUST_HAVE = [
  'bookings.cancel',
  'bookings.complete', // تأكيد الحجز — الـ API يمنعه من إدخال/رؤية المبلغ (المرحلة 2)
  'bookings.create',
  'bookings.read',
  'bookings.update',
  'customers.create',
  'customers.read',
  'customers.update',
  'recurring.manage', // الحجوزات الدورية — بلا مال ولا ماضٍ (docs/RECURRING_BOOKINGS_PLAN.md)
  'recurring.read',
  'services.read',
  'settings.read',
]

const STAFF_MUST_NOT_HAVE = [
  // المال
  'finance.read',
  'stats.read',
  // الماضي والحذف
  'bookings.history',
  'bookings.delete',
  'customers.delete',
  // الخدمات والإعدادات والمستخدمون
  'services.create',
  'services.update',
  'services.delete',
  'settings.update',
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'roles.read',
]

describe('مصفوفة الصلاحيات', () => {
  it('مفاتيح الصلاحيات فريدة وبصيغة resource.action', () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length)
    for (const key of ALL_KEYS) expect(key).toMatch(/^[a-z]+\.[a-z]+$/)
  })

  it('كل صلاحية للمشرف معرَّفة فعلاً', () => {
    for (const key of STAFF_PERMISSIONS) expect(ALL_KEYS).toContain(key)
  })

  it('المشرف يملك بالضبط ما هو مطلوب له', () => {
    expect([...STAFF_PERMISSIONS].sort()).toEqual([...STAFF_MUST_HAVE].sort())
  })

  it.each(STAFF_MUST_NOT_HAVE)('المشرف لا يملك %s', (key) => {
    expect(ALL_KEYS).toContain(key) // يكشف خطأ إملائياً في القائمة نفسها
    expect(STAFF_PERMISSIONS).not.toContain(key)
  })

  it('كل صلاحية معرَّفة إمّا للمشرف أو محظورة عليه صراحة', () => {
    const unclassified = ALL_KEYS.filter(
      (key) => !STAFF_MUST_HAVE.includes(key) && !STAFF_MUST_NOT_HAVE.includes(key),
    )
    expect(unclassified).toEqual([])
  })
})
