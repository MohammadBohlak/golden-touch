-- تراجع عن 20261114000000_recurring_bookings (docs/RECURRING_BOOKINGS_PLAN.md)
-- يزيل الجداول والأعمدة والقيود وروابط الصلاحيتين. الكود القديم يعمل مع القاعدة بعد التراجع.
-- ملاحظة: بعد حذف الأعمدة تصير الحجوزات المولَّدة حجوزات عادية (تفقد رابطها بالسلسلة).
-- إن لم تُرِد بقاءها فنفّذ الخطوة الاختيارية (0) أولاً — **تحذف بيانات**، فراجع العدد قبل التنفيذ.
-- وبعد التراجع يجب حذف سطر الـ migration من جدول _prisma_migrations (انظر آخر الملف) وإلا اعتبرها Prisma مطبَّقة.
BEGIN;

-- (0) اختياري — حذف المواعيد القادمة القيد العمل غير المعدّلة المولَّدة من سلاسل:
-- SELECT count(*) FROM "bookings" WHERE "recurringId" IS NOT NULL AND "status" = 'ACTIVE'
--   AND NOT "recurringEdited" AND "startAt" > now();
-- DELETE FROM "bookings" WHERE "recurringId" IS NOT NULL AND "status" = 'ACTIVE'
--   AND NOT "recurringEdited" AND "startAt" > now();

-- (1) الصلاحيات
DELETE FROM "permissions" WHERE "key" IN ('recurring.read', 'recurring.manage');
-- (حذف الصلاحية يحذف روابطها تلقائياً: _PermissionToRole مفتاحه الأجنبي ON DELETE CASCADE)

-- (2) الجداول والأعمدة
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_recurringId_fkey";
DROP INDEX IF EXISTS "bookings_recurringId_occurrenceDate_key";
DROP INDEX IF EXISTS "bookings_recurringId_startAt_idx";
ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "recurringId",
  DROP COLUMN IF EXISTS "occurrenceDate",
  DROP COLUMN IF EXISTS "recurringEdited";
DROP TABLE IF EXISTS "recurring_booking_services";
DROP TABLE IF EXISTS "recurring_bookings";

-- تحقق قبل COMMIT: لا يجوز أن يختفي قيد منع التداخل
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
    RAISE EXCEPTION 'bookings_no_overlap missing — aborting rollback';
  END IF;
END $$;

-- (3) إزالة سجل الـ migration كي لا تعتبرها Prisma مطبَّقة
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261114000000_recurring_bookings';

COMMIT;
