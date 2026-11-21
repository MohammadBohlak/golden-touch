-- إشعارات الطاقم قبل الموعد بـ 15 دقيقة (docs/PUSH_NOTIFICATIONS_PLAN.md — المرحلة 1)
-- additive فقط: جدول جديد + عمود اختياري في bookings، ولا حذف ولا تغيير لأي عمود موجود.
-- الكود القديم يتجاهل ما أُضيف فيبقى متوافقاً للخلف. لا يمسّ bookings_no_overlap.
-- الجزء الأول مولَّد بـ `prisma migrate diff` (بلا اتصال بالقاعدة)؛ الصلاحيات في آخره مكتوبة يدوياً.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "startAlertSentAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- الصلاحية (data migration idempotent — الإنتاج لا يشغّل db:seed)
-- على قاعدة جديدة لا توجد أدوار بعد فتنشئ صف الصلاحية فقط ثم يكمل الـ seed.
-- ─────────────────────────────────────────────────────────────

INSERT INTO "permissions" ("key", "description") VALUES
    ('notifications.receive', 'استقبال إشعارات الحجوزات قبل موعدها')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

-- المدير والمشرف يستقبلان الإشعارات (قرار D1 المعدَّل: الإشعار بلا أي حقل مالي أو تاريخي)
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" IN ('admin', 'staff')
  AND p."key" = 'notifications.receive'
ON CONFLICT DO NOTHING;
