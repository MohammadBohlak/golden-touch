-- تراجع عن staff_restrictions: يعيد روابط الأدوار والصلاحيات إلى لقطة ما قبل التطبيق
BEGIN;
DELETE FROM "_PermissionToRole" WHERE "B" = (SELECT "id" FROM "roles" WHERE "name" = 'admin');
INSERT INTO "_PermissionToRole" ("A","B") SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r WHERE r."name" = 'admin' AND p."key" IN ('bookings.cancel', 'bookings.complete', 'bookings.create', 'bookings.delete', 'bookings.read', 'bookings.update', 'customers.create', 'customers.delete', 'customers.read', 'customers.update', 'roles.read', 'services.create', 'services.delete', 'services.read', 'services.update', 'settings.read', 'settings.update', 'stats.read', 'users.create', 'users.delete', 'users.read', 'users.update');
DELETE FROM "_PermissionToRole" WHERE "B" = (SELECT "id" FROM "roles" WHERE "name" = 'staff');
INSERT INTO "_PermissionToRole" ("A","B") SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r WHERE r."name" = 'staff' AND p."key" IN ('bookings.cancel', 'bookings.complete', 'bookings.create', 'bookings.read', 'bookings.update', 'customers.create', 'customers.read', 'customers.update', 'services.read', 'settings.read', 'stats.read');
DELETE FROM "permissions" WHERE "key" IN ('finance.read', 'bookings.history');
COMMIT;
