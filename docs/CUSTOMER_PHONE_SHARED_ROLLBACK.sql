-- تراجع عن 20261120000000_customer_phone_shared
-- يعيد القيد الفريد لهاتف الزبون ويعيد customers.update للمشرف ويحذف سطر الـ migration.
-- ⚠ الخطوة (1) تفشل إن وُجد زبونان بالهاتف نفسه (وهذا مسموح بعد الـ migration):
--   تحقّق أولاً: SELECT "phone", count(*) FROM "customers" WHERE "phone" IS NOT NULL GROUP BY "phone" HAVING count(*) > 1;
--   وعالج التكرار (غيّر أحد الرقمين) قبل التنفيذ. لا يُحذف أي زبون من هنا.
-- بعد التراجع يجب إعادة الكود السابق (الذي يعتمد على unique)، وإلا أعطى تكرار الهاتف خطأ 409 عاماً.
BEGIN;

-- (1) القيد الفريد
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
DROP INDEX IF EXISTS "customers_phone_idx";

-- (2) صلاحية التعديل للمشرف
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" = 'staff' AND p."key" = 'customers.update'
ON CONFLICT DO NOTHING;

-- (3) سطر التسجيل (وإلا اعتبرها Prisma مطبَّقة)
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261120000000_customer_phone_shared';

-- تحقق قبل COMMIT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'customers_phone_key') THEN
    RAISE EXCEPTION 'القيد الفريد لم يُنشأ';
  END IF;
END $$;

COMMIT;
