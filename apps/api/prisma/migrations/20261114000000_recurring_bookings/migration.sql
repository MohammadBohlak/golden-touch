-- الحجوزات الدورية (docs/RECURRING_BOOKINGS_PLAN.md — المرحلة 2)
-- additive فقط: جدولان جديدان + ثلاثة أعمدة اختيارية في bookings، ولا حذف ولا تغيير لأي عمود موجود.
-- الكود القديم يتجاهل ما أُضيف فيبقى متوافقاً للخلف. لا يمسّ bookings_no_overlap ولا btree_gist.
-- الجزء الأول مولَّد بـ `prisma migrate diff` (بلا اتصال بالقاعدة) ثم راجعته يدوياً؛ الباقي مكتوب يدوياً.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "occurrenceDate" DATE,
ADD COLUMN     "recurringEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurringId" UUID;

-- CreateTable
CREATE TABLE "recurring_bookings" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "startTime" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "endDate" DATE,
    "notes" TEXT,
    "stoppedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recurring_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_booking_services" (
    "recurringId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "serviceId" UUID NOT NULL,

    CONSTRAINT "recurring_booking_services_pkey" PRIMARY KEY ("recurringId","position")
);

-- CreateIndex
CREATE INDEX "recurring_bookings_customerId_idx" ON "recurring_bookings"("customerId");

-- CreateIndex
CREATE INDEX "recurring_booking_services_serviceId_idx" ON "recurring_booking_services"("serviceId");

-- CreateIndex
CREATE INDEX "bookings_recurringId_startAt_idx" ON "bookings"("recurringId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_recurringId_occurrenceDate_key" ON "bookings"("recurringId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "recurring_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bookings" ADD CONSTRAINT "recurring_bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bookings" ADD CONSTRAINT "recurring_bookings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_booking_services" ADD CONSTRAINT "recurring_booking_services_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "recurring_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_booking_services" ADD CONSTRAINT "recurring_booking_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- قيود إضافية لا يعبّر عنها مخطط Prisma (مكتوبة يدوياً)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "recurring_bookings" ADD CONSTRAINT "recurring_bookings_interval_valid"
  CHECK ("intervalWeeks" BETWEEN 1 AND 4);
ALTER TABLE "recurring_bookings" ADD CONSTRAINT "recurring_bookings_time_format"
  CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "recurring_bookings" ADD CONSTRAINT "recurring_bookings_end_after_start"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
-- التناوب: 1–6 خدمات (المواضع 0..5)
ALTER TABLE "recurring_booking_services" ADD CONSTRAINT "recurring_booking_services_position_valid"
  CHECK ("position" BETWEEN 0 AND 5);

-- ─────────────────────────────────────────────────────────────
-- الصلاحيات (data migration idempotent — الإنتاج لا يشغّل db:seed)
-- على قاعدة جديدة لا توجد أدوار بعد فتنشئ صفوف الصلاحيات فقط ثم يكمل الـ seed.
-- ─────────────────────────────────────────────────────────────

INSERT INTO "permissions" ("key", "description") VALUES
    ('recurring.read', 'عرض الحجوزات الدورية'),
    ('recurring.manage', 'إنشاء الحجوزات الدورية وتعديلها وإيقافها')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

-- المدير والمشرف يملكان الصلاحيتين (قرار D12)
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" IN ('admin', 'staff')
  AND p."key" IN ('recurring.read', 'recurring.manage')
ON CONFLICT DO NOTHING;
