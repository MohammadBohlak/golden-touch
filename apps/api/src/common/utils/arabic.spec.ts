import { Prisma } from '@prisma/client'
import { normalizeArabic } from './arabic'
import { matchingIds, matchingValues, normalizedColumn } from './name-search'

describe('normalizeArabic', () => {
  it.each([
    ['أحمد', 'احمد'],
    ['إبراهيم', 'ابراهيم'],
    ['آمنة', 'امنه'],
    ['فاطمة', 'فاطمه'],
    ['ليلى', 'ليلي'],
    ['مؤمن', 'مومن'],
    ['رئيس', 'رييس'],
    ['مُحَمَّد', 'محمد'], // التشكيل
    ['محـــمد', 'محمد'], // التطويل
    ['  أحمد   علي  ', 'احمد علي'], // المسافات
    ['John SMITH', 'john smith'],
  ])('%s ← %s', (input, expected) => {
    expect(normalizeArabic(input)).toBe(expected)
  })

  it('«احمد» و«أحمد» و«إحمد» تتطابق، وكذلك «فاطمه» و«فاطمة»', () => {
    expect(normalizeArabic('احمد')).toBe(normalizeArabic('أحمد'))
    expect(normalizeArabic('احمد')).toBe(normalizeArabic('إحمد'))
    expect(normalizeArabic('فاطمه')).toBe(normalizeArabic('فاطمة'))
  })

  it('لا يغيّر الحروف الأخرى ولا الأرقام', () => {
    expect(normalizeArabic('سامر 123')).toBe('سامر 123')
  })

  it('idempotent', () => {
    const once = normalizeArabic('  أُمّ  الخَيْر ')
    expect(normalizeArabic(once)).toBe(once)
  })
})

describe('name-search', () => {
  const db = (rows: unknown[]) => ({ $queryRaw: jest.fn().mockResolvedValue(rows) })
  const sqlOf = (mock: jest.Mock) => mock.mock.calls[0][0] as Prisma.Sql

  it('matchingIds: يمرّر الاستعلام الموحَّد كمعامل (لا يُدمج في النص) ويعيد المعرّفات', async () => {
    const client = db([{ id: 'a' }, { id: 'b' }])
    const ids = await matchingIds(client as never, 'customers', '  أحمد ')
    expect(ids).toEqual(['a', 'b'])
    const sql = sqlOf(client.$queryRaw)
    expect(sql.values).toContain('احمد')
    expect(sql.sql).toContain('FROM "customers"')
    expect(sql.sql).toContain('strpos(')
    expect(sql.sql).not.toContain('احمد')
    expect(sql.sql).not.toContain('أحمد')
  })

  it('استعلام فارغ ← لا استعلام على القاعدة', async () => {
    const client = db([])
    expect(await matchingIds(client as never, 'customers', '   ')).toEqual([])
    expect(await matchingValues(client as never, 'bookingServiceName', '')).toEqual([])
    expect(client.$queryRaw).not.toHaveBeenCalled()
  })

  it('matchingValues: القيم المميّزة لأسماء الخدمات في الحجوزات', async () => {
    const client = db([{ value: 'حلاقة شعر' }])
    expect(await matchingValues(client as never, 'bookingServiceName', 'حلاقه')).toEqual([
      'حلاقة شعر',
    ])
    const sql = sqlOf(client.$queryRaw)
    expect(sql.sql).toContain('DISTINCT "serviceName"')
    expect(sql.sql).toContain('FROM "bookings"')
    expect(sql.values).toContain('حلاقه')
  })

  it('normalizedColumn: المعادلة تحوي كل مراحل التوحيد بمعاملات (التشكيل، translate، المسافات)', () => {
    const sql = normalizedColumn(Prisma.raw('"name"'))
    expect(sql.sql).toMatch(/lower\("name"\)/)
    expect(sql.sql).toContain('translate(')
    expect(sql.sql).toContain('btrim(')
    expect(sql.values).toContain('أإآٱىةؤئ')
    expect(sql.values).toContain('اااايهوي')
  })
})
