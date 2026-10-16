/**
 * Seed قابل للتكرار (idempotent): تشغيله أكثر من مرة لا يكرر البيانات ولا يكسر شيئاً.
 * يُشغَّل عبر `npm run db:seed` (Node يشغّل TypeScript مباشرة بإزالة الأنواع).
 */
import prismaPkg from '@prisma/client'
import bcrypt from 'bcrypt'

const { PrismaClient } = prismaPkg
const prisma = new PrismaClient()

const PERMISSIONS: Array<[key: string, description: string]> = [
  ['users.read', 'عرض المستخدمين'],
  ['users.create', 'إضافة مستخدم'],
  ['users.update', 'تعديل مستخدم'],
  ['users.delete', 'حذف مستخدم'],
  ['roles.read', 'عرض الأدوار والصلاحيات'],
  ['services.read', 'عرض الخدمات'],
  ['services.create', 'إضافة خدمة'],
  ['services.update', 'تعديل خدمة'],
  ['services.delete', 'حذف خدمة'],
  ['customers.read', 'عرض الزبائن'],
  ['customers.create', 'إضافة زبون'],
  ['customers.update', 'تعديل زبون'],
  ['customers.delete', 'حذف زبون'],
  ['bookings.read', 'عرض الحجوزات'],
  ['bookings.create', 'إنشاء حجز'],
  ['bookings.update', 'تعديل حجز'],
  ['bookings.complete', 'إكمال حجز وتسجيل الدفع'],
  ['bookings.cancel', 'إلغاء حجز'],
  ['bookings.delete', 'حذف حجز نهائياً'],
  ['stats.read', 'عرض الإحصائيات'],
  ['settings.read', 'عرض إعدادات الصالون'],
  ['settings.update', 'تعديل إعدادات الصالون'],
]

const STAFF_PERMISSIONS = [
  'services.read',
  'customers.read',
  'customers.create',
  'customers.update',
  'bookings.read',
  'bookings.create',
  'bookings.update',
  'bookings.complete',
  'bookings.cancel',
  'stats.read',
  'settings.read',
]

/** الأسعار تبقى 0 حتى يحددها الحلاق من صفحة الخدمات */
const DEFAULT_SERVICES = [
  { name: 'شعر', durationMinutes: 30, sortOrder: 1 },
  { name: 'ذقن', durationMinutes: 20, sortOrder: 2 },
  { name: 'شعر وذقن', durationMinutes: 60, sortOrder: 3 },
  { name: 'سشوار', durationMinutes: 15, sortOrder: 4 },
]

async function main() {
  for (const [key, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    })
  }

  const allKeys = PERMISSIONS.map(([key]) => ({ key }))
  const admin = await prisma.role.upsert({
    where: { name: 'admin' },
    update: { label: 'المدير', permissions: { set: allKeys } },
    create: { name: 'admin', label: 'المدير', permissions: { connect: allKeys } },
  })
  const staffKeys = STAFF_PERMISSIONS.map((key) => ({ key }))
  await prisma.role.upsert({
    where: { name: 'staff' },
    update: { label: 'مشرف الحجوزات', permissions: { set: staffKeys } },
    create: { name: 'staff', label: 'مشرف الحجوزات', permissions: { connect: staffKeys } },
  })

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'مدير الصالون'
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL و SEED_ADMIN_PASSWORD مطلوبان لإنشاء حساب المدير')
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    // لا نعيد تعيين كلمة المرور عند إعادة التشغيل — فقط نضمن أنه مدير مفعّل
    await prisma.user.update({ where: { email }, data: { roleId: admin.id, isActive: true } })
  } else {
    await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), roleId: admin.id },
    })
  }

  await prisma.shopSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })

  if ((await prisma.service.count()) === 0) {
    await prisma.service.createMany({ data: DEFAULT_SERVICES.map((s) => ({ ...s, price: 0 })) })
  }

  console.log(`✔ seed done — admin: ${email}`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
