/**
 * إثبات migration الحجوزات الدورية **دون إبقاء أي أثر**: كل شيء داخل معاملة واحدة تُلغى دائماً.
 * docs/RECURRING_BOOKINGS_PLAN.md — المرحلة 2.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON prisma/verify-recurring-migration.mjs
 *
 * يتحقق من: نجاح أوامر الـ SQL، بقاء bookings_no_overlap، عدم تغيّر أعداد الصفوف الموجودة،
 * idempotency جزء الصلاحيات، رفض القيود الجديدة، وأن createMany({ skipDuplicates }) يتخطّى
 * مخالفة القيد الفريد **وقيد EXCLUDE** دون أن يُسقط بقية الدفعة (افتراض D7 في الخطة).
 *
 * تنبيهات: (1) يتصل بقاعدة DATABASE_URL = الإنتاج الحي. لا يكتب شيئاً يبقى، لكن ALTER TABLE على
 * bookings يحجز القفل حتى نهاية المعاملة (ثوانٍ) فشغّله والصالون هادئ. (2) لا يطبع أسماء ولا هواتف.
 * (3) إن كان المنفذ 5432 غير سليم فمرّر DATABASE_URL مؤقتاً بالمنفذ 6543 كمتغير بيئة لا بتعديل .env.
 */
import { readFileSync } from 'node:fs'
import prismaPkg from '@prisma/client'

const { PrismaClient } = prismaPkg
const prisma = new PrismaClient()

const MIGRATION = new URL(
  './migrations/20261114000000_recurring_bookings/migration.sql',
  import.meta.url,
)
const statements = readFileSync(MIGRATION, 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean)

const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail })
const ROLLBACK = 'ROLLBACK_SENTINEL'

async function counts(tx) {
  const [row] = await tx.$queryRawUnsafe(`
    SELECT
      (SELECT count(*) FROM "bookings")::int AS bookings,
      (SELECT count(*) FROM "customers")::int AS customers,
      (SELECT count(*) FROM "services")::int AS services,
      (SELECT count(*) FROM "users")::int AS users,
      (SELECT count(*) FROM "permissions")::int AS permissions,
      (SELECT count(*) FROM "_PermissionToRole")::int AS links`)
  return row
}

/** يشغّل مخالفة متوقَّعة داخل SAVEPOINT كي لا تُسقط المعاملة */
async function expectRejected(tx, name, sql) {
  await tx.$executeRawUnsafe('SAVEPOINT chk')
  try {
    await tx.$executeRawUnsafe(sql)
    check(name, false, 'قُبلت قيمة غير صالحة')
  } catch {
    check(name, true)
  }
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT chk')
}

try {
  await prisma.$transaction(
    async (tx) => {
      const before = await counts(tx)
      const [{ n: overlapBefore }] = await tx.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'bookings_no_overlap'`,
      )
      check('قيد bookings_no_overlap موجود قبل التطبيق', overlapBefore === 1)

      for (const sql of statements) await tx.$executeRawUnsafe(sql)
      check('كل أوامر الـ migration نُفّذت', true, `${statements.length} أمراً`)

      const [{ n: overlapAfter }] = await tx.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'bookings_no_overlap'`,
      )
      check('قيد bookings_no_overlap باقٍ', overlapAfter === 1)

      const after = await counts(tx)
      for (const key of ['bookings', 'customers', 'services', 'users']) {
        check(`عدد ${key} لم يتغيّر`, before[key] === after[key], `${before[key]} → ${after[key]}`)
      }
      check('أُضيفت صلاحيتان بالضبط', after.permissions - before.permissions === 2)
      const [{ n: adminStaff }] = await tx.$queryRawUnsafe(`
        SELECT count(*)::int AS n FROM "_PermissionToRole" l
        JOIN "permissions" p ON p."id" = l."A" JOIN "roles" r ON r."id" = l."B"
        WHERE p."key" LIKE 'recurring.%' AND r."name" IN ('admin', 'staff')`)
      const [{ n: roleCount }] = await tx.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM "roles" WHERE "name" IN ('admin', 'staff')`,
      )
      check(
        'رُبطت الصلاحيتان بالمدير والمشرف',
        adminStaff === roleCount * 2,
        `${adminStaff} رابطاً`,
      )

      // idempotency: إعادة تشغيل جزء الصلاحيات لا تغيّر شيئاً
      const dataPart = statements.filter((s) => /INTO "(permissions|_PermissionToRole)"/.test(s))
      for (const sql of dataPart) await tx.$executeRawUnsafe(sql)
      const again = await counts(tx)
      check(
        'جزء الصلاحيات idempotent',
        again.permissions === after.permissions && again.links === after.links,
      )

      // القيود الجديدة ترفض القيم غير الصالحة (مع صفّ خدمة/زبون تجريبيين داخل المعاملة)
      const customer = await tx.customer.create({ data: { name: '__verify__' } })
      const service = await tx.service.create({
        data: { name: '__verify__', price: 0, durationMinutes: 30 },
      })
      const series = (extra) =>
        `INSERT INTO "recurring_bookings" ("id","customerId","startTime","startDate","intervalWeeks","endDate","updatedAt")
         VALUES (gen_random_uuid(), '${customer.id}', ${extra})`
      await expectRejected(
        tx,
        'يرفض intervalWeeks = 5',
        series(`'10:00','2030-01-05',5,NULL,now()`),
      )
      await expectRejected(
        tx,
        'يرفض startTime = 25:00',
        series(`'25:00','2030-01-05',1,NULL,now()`),
      )
      await expectRejected(
        tx,
        'يرفض endDate قبل startDate',
        series(`'10:00','2030-01-05',1,'2030-01-01',now()`),
      )

      const recurring = await tx.recurringBooking.create({
        data: {
          customerId: customer.id,
          startTime: '10:00',
          startDate: new Date('2030-01-05'),
          intervalWeeks: 1,
          services: { create: [{ position: 0, serviceId: service.id }] },
        },
      })
      await expectRejected(
        tx,
        'يرفض position = 6',
        `INSERT INTO "recurring_booking_services" ("recurringId","position","serviceId")
         VALUES ('${recurring.id}', 6, '${service.id}')`,
      )

      // ON CONFLICT DO NOTHING عبر createMany({ skipDuplicates })
      const row = (date, startIso, endIso) => ({
        customerId: customer.id,
        serviceId: service.id,
        serviceName: '__verify__',
        price: 0,
        durationMinutes: 30,
        startAt: new Date(startIso),
        endAt: new Date(endIso),
        recurringId: recurring.id,
        occurrenceDate: new Date(date),
      })
      const base = row('2030-01-05', '2030-01-05T10:00:00Z', '2030-01-05T10:30:00Z')
      await tx.booking.create({ data: base })

      const skip = (data) => tx.booking.createMany({ data, skipDuplicates: true })
      await tx.$executeRawUnsafe('SAVEPOINT dup')
      try {
        const dup = await skip([row('2030-01-05', '2030-01-05T14:00:00Z', '2030-01-05T14:30:00Z')])
        check(
          'skipDuplicates يتخطّى تكرار (recurringId, occurrenceDate)',
          dup.count === 0,
          `count=${dup.count}`,
        )
      } catch (e) {
        check(
          'skipDuplicates يتخطّى تكرار (recurringId, occurrenceDate)',
          false,
          String(e.message).slice(0, 120),
        )
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT dup')
      }

      await tx.$executeRawUnsafe('SAVEPOINT mixed')
      try {
        const mixed = await skip([
          row('2030-01-12', '2030-01-12T10:00:00Z', '2030-01-12T10:30:00Z'), // سليم → يُنشأ
          row('2030-01-19', '2030-01-05T10:15:00Z', '2030-01-05T10:45:00Z'), // يتداخل مع base (EXCLUDE) → يُتخطّى
          row('2030-01-05', '2030-01-05T16:00:00Z', '2030-01-05T16:30:00Z'), // تكرار فريد → يُتخطّى
          row('2030-01-26', '2030-01-26T10:00:00Z', '2030-01-26T10:30:00Z'), // سليم بعد المخالفتين → يُنشأ
        ])
        check(
          'skipDuplicates يتخطّى مخالفة EXCLUDE والفريد ويُنشئ السليم من نفس الدفعة',
          mixed.count === 2,
          `count=${mixed.count} (المتوقع 2)`,
        )
      } catch (e) {
        check(
          'skipDuplicates يتخطّى مخالفة EXCLUDE والفريد ويُنشئ السليم من نفس الدفعة',
          false,
          `رمى خطأ: ${String(e.message).slice(0, 160)} ← المرحلة 3 تستعمل إدراجاً صفاً صفاً`,
        )
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT mixed')
      }

      throw new Error(ROLLBACK)
    },
    { timeout: 120_000, maxWait: 20_000 },
  )
} catch (error) {
  if (!(error instanceof Error) || error.message !== ROLLBACK) {
    check('اكتمل التنفيذ دون خطأ غير متوقَّع', false, String(error?.message ?? error).slice(0, 300))
  }
}

// بعد الإلغاء: لا أثر
const [leftover] = await prisma.$queryRawUnsafe(`
  SELECT to_regclass('public.recurring_bookings') IS NULL AS no_table,
         (SELECT count(*) FROM "permissions" WHERE "key" LIKE 'recurring.%')::int AS perms,
         (SELECT count(*) FROM "customers" WHERE "name" = '__verify__')::int AS test_rows`)
check('أُلغيت المعاملة: لا جدول جديد', leftover.no_table)
check('أُلغيت المعاملة: لا صلاحيات جديدة', leftover.perms === 0)
check('أُلغيت المعاملة: لا صفوف تجريبية', leftover.test_rows === 0)

for (const r of results)
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `\n${failed} فشل` : '\nكل الفحوصات نجحت (المعاملة أُلغيت، لم يُكتب شيء).')
await prisma.$disconnect()
process.exit(failed ? 1 : 0)
