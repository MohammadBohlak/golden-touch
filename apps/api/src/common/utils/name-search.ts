/**
 * بحث الأسماء بالتوحيد العربي في PostgreSQL: تُطبَّق على العمود المعادلة نفسها في `normalizeArabic`
 * (lower ← حذف التشكيل ← translate لتوحيد الحروف ← ضغط المسافات) ثم `strpos` — فلا حاجة لعمود إضافي
 * ولا لـ migration، ولا مشكلة هروب لـ % و _ كما في LIKE. تعيد معرّفات/قيماً تُمرَّر إلى استعلام Prisma العادي
 * فيبقى الترقيم والترتيب والعدّ كما هي.
 */
import { Prisma } from '@prisma/client'
import { DIACRITICS_CLASS, FOLD_FROM, FOLD_TO, normalizeArabic } from './arabic'

type RawClient = { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> }

/** معرّفات الأعمدة ثابتة من الكود (لا تأتي من المستخدم أبداً) */
const IDENTIFIERS = {
  customers: { table: '"customers"', column: '"name"' },
  bookingServiceName: { table: '"bookings"', column: '"serviceName"' },
} as const
export type SearchTarget = keyof typeof IDENTIFIERS

/** عمود موحَّد بمعادلة normalizeArabic نفسها (مُصدَّر للتحقق من تطابق SQL مع JS) */
export function normalizedColumn(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`btrim(regexp_replace(translate(regexp_replace(lower(${column}), ${`[${DIACRITICS_CLASS}]`}, '', 'g'), ${FOLD_FROM}, ${FOLD_TO}), '[[:space:]]+', ' ', 'g'))`
}

/** معرّفات صفوف عمودها يحوي الاستعلام بعد التوحيد (فارغ إن كان الاستعلام فارغاً) */
export async function matchingIds(
  db: RawClient,
  target: 'customers',
  search: string,
): Promise<string[]> {
  const q = normalizeArabic(search)
  if (!q) return []
  const { table, column } = IDENTIFIERS[target]
  const rows = await db.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM ${Prisma.raw(table)} WHERE strpos(${normalizedColumn(Prisma.raw(column))}, ${q}) > 0`,
  )
  return rows.map((r) => r.id)
}

/** القيم المميّزة (مثل أسماء الخدمات في الحجوزات) التي تحوي الاستعلام بعد التوحيد */
export async function matchingValues(
  db: RawClient,
  target: 'bookingServiceName',
  search: string,
): Promise<string[]> {
  const q = normalizeArabic(search)
  if (!q) return []
  const { table, column } = IDENTIFIERS[target]
  const rows = await db.$queryRaw<{ value: string }[]>(
    Prisma.sql`SELECT DISTINCT ${Prisma.raw(column)} AS "value" FROM ${Prisma.raw(table)} WHERE strpos(${normalizedColumn(Prisma.raw(column))}, ${q}) > 0`,
  )
  return rows.map((r) => r.value)
}
