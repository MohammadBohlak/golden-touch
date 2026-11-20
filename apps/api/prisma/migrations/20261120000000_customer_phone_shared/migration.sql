-- هاتف الزبون لم يعد فريداً: التكرار مسموح بموافقة المستخدم (الـ API يرجع 409 PHONE_DUPLICATE
-- ويعيد الإرسال بـ confirmDuplicatePhone). يُستبدل القيد الفريد بفهرس عادي للبحث والمطابقة.
-- لا يلمس أي صف بيانات في customers، وهي idempotent.
DROP INDEX IF EXISTS "customers_phone_key";
CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers"("phone");

-- تعديل بيانات الزبون للمدير وحده: سحب customers.update من المشرف (الإنتاج لا يشغّل db:seed).
-- المدير يحتفظ بها؛ المشرف يبقى بـ customers.read / customers.create.
DELETE FROM "_PermissionToRole"
WHERE "B" IN (SELECT "id" FROM "roles" WHERE "name" = 'staff')
  AND "A" IN (SELECT "id" FROM "permissions" WHERE "key" = 'customers.update');
