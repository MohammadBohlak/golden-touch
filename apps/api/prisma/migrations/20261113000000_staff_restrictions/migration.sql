-- تقييد مشرف الحجوزات (docs/STAFF_RESTRICTIONS_PLAN.md — المرحلة 1)
-- migration بيانات فقط (لا تغيير في المخطط)، وهي idempotent. الإنتاج يشغّل
-- `prisma migrate deploy` ولا يشغّل db:seed، فهذا هو المسار الذي توصل به الصلاحيات.
-- على قاعدة جديدة لا توجد أدوار بعد فتنشئ الجداول صفوف الصلاحيات فقط ثم يكمل الـ seed.

-- 1) الصلاحيتان الجديدتان
INSERT INTO "permissions" ("key", "description") VALUES
    ('finance.read', 'عرض الأسعار والمبالغ المالية'),
    ('bookings.history', 'عرض الحجوزات السابقة وسجل الزبائن')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

-- 2) المدير يملكهما (المشرف لا يُمنح أياً منهما)
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" = 'admin'
  AND p."key" IN ('finance.read', 'bookings.history')
ON CONFLICT DO NOTHING;

-- 3) سحب الإحصائيات من المشرف. (يحتفظ بـ bookings.complete: تأكيد الحجز بسعره المحفوظ.)
DELETE FROM "_PermissionToRole"
WHERE "B" IN (SELECT "id" FROM "roles" WHERE "name" = 'staff')
  AND "A" IN (SELECT "id" FROM "permissions" WHERE "key" = 'stats.read');
