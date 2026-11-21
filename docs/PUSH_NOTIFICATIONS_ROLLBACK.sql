-- تراجع عن 20261121000000_push_notifications (docs/PUSH_NOTIFICATIONS_PLAN.md)
-- يزيل جدول الاشتراكات وعمود startAlertSentAt وصلاحية notifications.receive. الكود القديم يعمل بعد التراجع.
-- ⚠ يحذف اشتراكات الأجهزة (يعيد كل مستخدم تفعيل الإشعارات لاحقاً)، ولا يمسّ أي حجز أو زبون.
-- بعد التراجع يجب إعادة الكود السابق (الجديد يقرأ الجدول والعمود) وحذف سطر الـ migration (الخطوة 3).
BEGIN;

-- (1) الصلاحية (حذفها يحذف روابطها تلقائياً: _PermissionToRole مفتاحه الأجنبي ON DELETE CASCADE)
DELETE FROM "permissions" WHERE "key" = 'notifications.receive';

-- (2) الجدول والعمود
DROP TABLE IF EXISTS "push_subscriptions";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "startAlertSentAt";

-- تحقق قبل COMMIT: لا يجوز أن يختفي قيد منع التداخل
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
    RAISE EXCEPTION 'bookings_no_overlap missing — aborting rollback';
  END IF;
END $$;

-- (3) إزالة سجل الـ migration كي لا تعتبرها Prisma مطبَّقة
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261121000000_push_notifications';

COMMIT;
