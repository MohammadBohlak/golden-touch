import type { ShopHours } from '../bookings/schedule'
import {
  blocksHardDelete,
  ExistingOccurrence,
  isRewritable,
  occurrenceDates,
  occurrenceIndex,
  occurrenceStart,
  planOccurrences,
  PlanService,
  planSeriesChange,
  SeriesTemplate,
  serviceIdAt,
} from './recurrence'

/**
 * "الآن" = 2026-10-16 15:00 بتوقيت دمشق (+3) — جمعة. 2026-10-17 سبت.
 * الدوام الافتراضي 10:00–22:00، فالساعة 17:00 محلياً = 14:00Z.
 */
const NOW = new Date('2026-10-16T12:00:00Z')
const HOURS: ShopHours = {
  openTime: '10:00',
  closeTime: '22:00',
  daysOff: [],
  timezone: 'Asia/Damascus',
}
const A: PlanService = { id: 'a', name: 'شعر', durationMinutes: 30, available: true }
const B: PlanService = { id: 'b', name: 'لحية', durationMinutes: 45, available: true }

const series = (over: Partial<SeriesTemplate> = {}): SeriesTemplate => ({
  startDate: '2026-10-17',
  startTime: '17:00',
  intervalWeeks: 1,
  endDate: null,
  stopped: false,
  serviceIds: ['a'],
  ...over,
})
const dates = (list: { date: string }[]) => list.map((o) => o.date)
const z = (iso: string) => new Date(iso)

function plan(over: Partial<Parameters<typeof planOccurrences>[0]> = {}) {
  return planOccurrences({
    series: series(),
    services: [A, B],
    hours: HOURS,
    from: '2026-10-16',
    to: '2026-11-06',
    now: NOW,
    existingDates: new Set(),
    busy: [],
    ...over,
  })
}

describe('serviceIdAt', () => {
  it('خدمة واحدة ثابتة', () => {
    expect([0, 1, 5].map((k) => serviceIdAt(['a'], k))).toEqual(['a', 'a', 'a'])
  })

  it('تناوب خدمتين', () => {
    expect([0, 1, 2, 3].map((k) => serviceIdAt(['a', 'b'], k))).toEqual(['a', 'b', 'a', 'b'])
  })

  it('يسمح بالتكرار (أ، أ، ب)', () => {
    expect([0, 1, 2, 3, 4, 5].map((k) => serviceIdAt(['a', 'a', 'b'], k))).toEqual([
      'a',
      'a',
      'b',
      'a',
      'a',
      'b',
    ])
  })
})

describe('occurrenceIndex', () => {
  const s = { startDate: '2026-10-17', intervalWeeks: 2 }

  it('يرقّم المواعيد من الصفر', () => {
    expect(occurrenceIndex(s, '2026-10-17')).toBe(0)
    expect(occurrenceIndex(s, '2026-10-31')).toBe(1)
    expect(occurrenceIndex(s, '2026-11-14')).toBe(2)
  })

  it('null لتاريخ خارج الجدول أو قبل البداية', () => {
    expect(occurrenceIndex(s, '2026-10-24')).toBeNull() // الأسبوع «اللا»
    expect(occurrenceIndex(s, '2026-10-18')).toBeNull()
    expect(occurrenceIndex(s, '2026-10-03')).toBeNull()
  })
})

describe('occurrenceDates', () => {
  it('أسبوعي: كل سبت', () => {
    expect(
      occurrenceDates(
        { startDate: '2026-10-17', intervalWeeks: 1, endDate: null },
        '2026-10-17',
        '2026-11-07',
      ),
    ).toEqual([
      { date: '2026-10-17', k: 0 },
      { date: '2026-10-24', k: 1 },
      { date: '2026-10-31', k: 2 },
      { date: '2026-11-07', k: 3 },
    ])
  })

  it('أسبوع نعم وأسبوع لا: الطور محفوظ مهما بدأ النطاق', () => {
    const s = { startDate: '2026-10-17', intervalWeeks: 2, endDate: null }
    expect(dates(occurrenceDates(s, '2026-10-17', '2026-11-30'))).toEqual([
      '2026-10-17',
      '2026-10-31',
      '2026-11-14',
      '2026-11-28',
    ])
    // نطاق يبدأ في منتصف السلسلة: يبقى الطور نفسه ويحمل k الصحيح
    expect(occurrenceDates(s, '2026-10-24', '2026-11-30')).toEqual([
      { date: '2026-10-31', k: 1 },
      { date: '2026-11-14', k: 2 },
      { date: '2026-11-28', k: 3 },
    ])
  })

  it('كل 3 و4 أسابيع', () => {
    expect(
      dates(
        occurrenceDates(
          { startDate: '2026-10-17', intervalWeeks: 3, endDate: null },
          '2026-10-01',
          '2026-12-31',
        ),
      ),
    ).toEqual(['2026-10-17', '2026-11-07', '2026-11-28', '2026-12-19'])
    expect(
      dates(
        occurrenceDates(
          { startDate: '2026-10-17', intervalWeeks: 4, endDate: null },
          '2026-10-01',
          '2026-12-31',
        ),
      ),
    ).toEqual(['2026-10-17', '2026-11-14', '2026-12-12'])
  })

  it('الحدّان شاملان (from و to و endDate)', () => {
    const s = { startDate: '2026-10-17', intervalWeeks: 1, endDate: '2026-10-31' }
    expect(dates(occurrenceDates(s, '2026-10-24', '2026-12-31'))).toEqual([
      '2026-10-24',
      '2026-10-31',
    ])
    expect(dates(occurrenceDates(s, '2026-10-01', '2026-10-24'))).toEqual([
      '2026-10-17',
      '2026-10-24',
    ])
  })

  it('لا شيء قبل startDate ولا عند نطاق مقلوب', () => {
    const s = { startDate: '2026-10-17', intervalWeeks: 1, endDate: null }
    expect(occurrenceDates(s, '2026-09-01', '2026-10-16')).toEqual([])
    expect(occurrenceDates(s, '2026-11-01', '2026-10-01')).toEqual([])
  })

  it('عبور حدود الشهر والسنة', () => {
    const s = { startDate: '2026-12-19', intervalWeeks: 2, endDate: null }
    expect(dates(occurrenceDates(s, '2026-12-01', '2027-02-01'))).toEqual([
      '2026-12-19',
      '2027-01-02',
      '2027-01-16',
      '2027-01-30',
    ])
  })

  it('يرفض فاصلاً غير صالح', () => {
    for (const intervalWeeks of [0, 5, 1.5, -1]) {
      expect(() =>
        occurrenceDates(
          { startDate: '2026-10-17', intervalWeeks, endDate: null },
          '2026-10-17',
          '2026-11-01',
        ),
      ).toThrow()
    }
  })
})

describe('occurrenceStart', () => {
  it('الساعة المحلية بتوقيت الصالون (دمشق +3)', () => {
    expect(occurrenceStart('2026-10-17', '17:00', HOURS)).toEqual(z('2026-10-17T14:00:00Z'))
  })

  it('دوام يتخطّى منتصف الليل: 01:00 تتبع يوم الدوام فتقع صباح اليوم التالي', () => {
    const night: ShopHours = { ...HOURS, openTime: '18:00', closeTime: '02:00' }
    expect(occurrenceStart('2026-10-17', '19:00', night)).toEqual(z('2026-10-17T16:00:00Z'))
    expect(occurrenceStart('2026-10-17', '01:00', night)).toEqual(z('2026-10-17T22:00:00Z'))
  })

  it('توقيت صيفي: تبقى الساعة المحلية ثابتة ويتغيّر UTC', () => {
    const ny: ShopHours = {
      openTime: '08:00',
      closeTime: '20:00',
      daysOff: [],
      timezone: 'America/New_York',
    }
    expect(occurrenceStart('2026-03-01', '09:00', ny)).toEqual(z('2026-03-01T14:00:00Z')) // EST -5
    expect(occurrenceStart('2026-03-08', '09:00', ny)).toEqual(z('2026-03-08T13:00:00Z')) // EDT -4
  })
})

describe('planOccurrences', () => {
  it('أسبوعي: ينشئ كل المواعيد ضمن النطاق بالخدمة ومدتها', () => {
    const result = plan()
    expect(result.issues).toEqual([])
    expect(result.create).toEqual([
      {
        date: '2026-10-17',
        k: 0,
        serviceId: 'a',
        startAt: z('2026-10-17T14:00:00Z'),
        endAt: z('2026-10-17T14:30:00Z'),
      },
      {
        date: '2026-10-24',
        k: 1,
        serviceId: 'a',
        startAt: z('2026-10-24T14:00:00Z'),
        endAt: z('2026-10-24T14:30:00Z'),
      },
      {
        date: '2026-10-31',
        k: 2,
        serviceId: 'a',
        startAt: z('2026-10-31T14:00:00Z'),
        endAt: z('2026-10-31T14:30:00Z'),
      },
    ])
  })

  it('أسبوعان: الأسبوع «اللا» لا يُنشأ', () => {
    expect(dates(plan({ series: series({ intervalWeeks: 2 }), to: '2026-11-30' }).create)).toEqual([
      '2026-10-17',
      '2026-10-31',
      '2026-11-14',
      '2026-11-28',
    ])
  })

  it('تناوب خدمتين بمدتين مختلفتين', () => {
    const result = plan({ series: series({ serviceIds: ['a', 'b'] }) })
    expect(result.create.map((o) => [o.date, o.serviceId])).toEqual([
      ['2026-10-17', 'a'],
      ['2026-10-24', 'b'],
      ['2026-10-31', 'a'],
    ])
    expect(result.create[1].endAt).toEqual(z('2026-10-24T14:45:00Z'))
  })

  it('الموعد الموجود يستهلك دوره ولا يُعاد', () => {
    const result = plan({
      series: series({ serviceIds: ['a', 'b'] }),
      existingDates: new Set(['2026-10-24']),
    })
    expect(result.create.map((o) => [o.date, o.serviceId])).toEqual([
      ['2026-10-17', 'a'],
      ['2026-10-31', 'a'], // k = 2 → أ (لا يتحرّك الدور لأن الأسبوع الثاني تُرك)
    ])
  })

  it('سلسلة موقوفة: لا شيء ولا مشكلات', () => {
    expect(plan({ series: series({ stopped: true }) })).toEqual({ create: [], issues: [] })
  })

  it('endDate شامل', () => {
    expect(dates(plan({ series: series({ endDate: '2026-10-24' }) }).create)).toEqual([
      '2026-10-17',
      '2026-10-24',
    ])
  })

  it('لا يُنشأ موعد بدايته ≤ الآن، ويُتجاهل بصمت', () => {
    // اليوم الجمعة 16: 14:00 محلياً = 11:00Z ≤ NOW فيُتجاهل، و16:00 = 13:00Z > NOW فيُنشأ
    const early = plan({
      series: series({ startDate: '2026-10-16', startTime: '14:00' }),
      to: '2026-10-16',
    })
    expect(early).toEqual({ create: [], issues: [] })
    const later = plan({
      series: series({ startDate: '2026-10-16', startTime: '16:00' }),
      to: '2026-10-16',
    })
    expect(dates(later.create)).toEqual(['2026-10-16'])
  })

  it('يوم عطلة ← CLOSED', () => {
    const result = plan({ hours: { ...HOURS, daysOff: [6] } }) // السبت
    expect(result.create).toEqual([])
    expect(result.issues.map((i) => i.reason)).toEqual(['CLOSED', 'CLOSED', 'CLOSED'])
  })

  it('خارج الدوام: قبل الفتح أو تنتهي بعد الإغلاق ← OUTSIDE_HOURS', () => {
    expect(plan({ series: series({ startTime: '09:30' }) }).issues[0].reason).toBe('OUTSIDE_HOURS')
    expect(plan({ series: series({ startTime: '21:45' }) }).issues[0].reason).toBe('OUTSIDE_HOURS') // تنتهي 22:15
    expect(plan({ series: series({ startTime: '21:30' }) }).issues).toEqual([]) // تنتهي 22:00 تماماً
  })

  it('دوام بعد منتصف الليل: 01:00 ضمن النافذة، و03:00 خارجها', () => {
    const night: ShopHours = { ...HOURS, openTime: '18:00', closeTime: '02:00' }
    const ok = plan({ series: series({ startTime: '01:00' }), hours: night })
    expect(ok.issues).toEqual([])
    expect(ok.create[0].startAt).toEqual(z('2026-10-17T22:00:00Z'))
    expect(plan({ series: series({ startTime: '03:00' }), hours: night }).issues[0].reason).toBe(
      'OUTSIDE_HOURS',
    )
  })

  it('خدمة مؤرشفة/معطّلة/غير موجودة ← SERVICE_UNAVAILABLE فقط لموعدها', () => {
    const result = plan({
      series: series({ serviceIds: ['a', 'b'] }),
      services: [A, { ...B, available: false }],
    })
    expect(result.create.map((o) => o.date)).toEqual(['2026-10-17', '2026-10-31'])
    expect(result.issues).toEqual([{ date: '2026-10-24', k: 1, reason: 'SERVICE_UNAVAILABLE' }])
    expect(plan({ services: [] }).issues.every((i) => i.reason === 'SERVICE_UNAVAILABLE')).toBe(
      true,
    )
  })

  it('تداخل مع حجز قائم ← CONFLICT ولا يُزاح الحجز', () => {
    const busy = [{ start: z('2026-10-24T14:15:00Z'), end: z('2026-10-24T15:00:00Z') }]
    const result = plan({ busy })
    expect(dates(result.create)).toEqual(['2026-10-17', '2026-10-31'])
    expect(result.issues).toEqual([{ date: '2026-10-24', k: 1, reason: 'CONFLICT' }])
  })

  it('الحجز المتلاصق ليس تداخلاً (النهاية حصرية)', () => {
    const busy = [
      { start: z('2026-10-17T13:30:00Z'), end: z('2026-10-17T14:00:00Z') }, // ينتهي عند بداية الموعد
      { start: z('2026-10-24T14:30:00Z'), end: z('2026-10-24T15:00:00Z') }, // يبدأ عند نهايته
    ]
    const result = plan({ busy })
    expect(result.issues).toEqual([])
    expect(dates(result.create)).toEqual(['2026-10-17', '2026-10-24', '2026-10-31'])
  })

  it('لا يعدّل مصفوفة busy الممرَّرة', () => {
    const busy = [{ start: z('2026-10-24T14:15:00Z'), end: z('2026-10-24T15:00:00Z') }]
    plan({ busy })
    expect(busy).toHaveLength(1)
  })

  it('توقيت صيفي: ساعة محلية ثابتة عبر تغيير التوقيت', () => {
    const ny: ShopHours = {
      openTime: '08:00',
      closeTime: '20:00',
      daysOff: [],
      timezone: 'America/New_York',
    }
    const result = plan({
      series: series({ startDate: '2026-03-01', startTime: '09:00' }),
      hours: ny,
      now: z('2026-02-01T00:00:00Z'),
      from: '2026-03-01',
      to: '2026-03-15',
    })
    expect(result.create.map((o) => o.startAt.toISOString())).toEqual([
      '2026-03-01T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-15T13:00:00.000Z',
    ])
  })

  it('يرفض قالباً بلا خدمات أو بأكثر من 6', () => {
    expect(() => plan({ series: series({ serviceIds: [] }) })).toThrow()
    expect(() =>
      plan({ series: series({ serviceIds: ['a', 'a', 'a', 'a', 'a', 'a', 'a'] }) }),
    ).toThrow()
  })
})

describe('planSeriesChange', () => {
  const FROM = '2026-10-16'
  const TO = '2026-11-07'
  const e = (
    over: Pick<ExistingOccurrence, 'id' | 'occurrenceDate'> & Partial<ExistingOccurrence>,
  ): ExistingOccurrence => ({
    startAt: z(`${over.occurrenceDate}T14:00:00Z`),
    endAt: z(`${over.occurrenceDate}T14:30:00Z`),
    status: 'ACTIVE',
    edited: false,
    ...over,
  })
  const e1 = e({ id: 'e1', occurrenceDate: '2026-10-17' }) // قادم، قيد العمل، غير معدّل ← يُعاد كتابته
  const e2 = e({ id: 'e2', occurrenceDate: '2026-10-24', edited: true }) // معدّل يدوياً ← يبقى
  const e3 = e({ id: 'e3', occurrenceDate: '2026-10-31', status: 'CANCELLED' }) // ملغى ← يبقى ولا يُعاد
  const e4 = e({ id: 'e4', occurrenceDate: '2026-10-10', status: 'COMPLETED' }) // ماضٍ
  const existing = [e1, e2, e3, e4]
  const busyOf = (list: ExistingOccurrence[]) =>
    list
      .filter((b) => b.status !== 'CANCELLED')
      .map((b) => ({ id: b.id, start: b.startAt, end: b.endAt }))
  const template = series({ startDate: '2026-10-10' })

  it('isRewritable: قادم + قيد العمل + غير معدّل فقط', () => {
    expect(existing.filter((b) => isRewritable(b, NOW)).map((b) => b.id)).toEqual(['e1'])
    expect(isRewritable({ ...e1, startAt: z('2026-10-16T11:00:00Z') }, NOW)).toBe(false) // مضى اليوم
  })

  it('تعديل: يحذف القابل فقط، ولا يعيد المعدّل ولا الملغى، ويُنشئ الفراغ', () => {
    const change = planSeriesChange({
      series: { ...template, startTime: '17:00' },
      services: [A],
      hours: HOURS,
      from: FROM,
      to: TO,
      now: NOW,
      existing,
      busy: busyOf(existing),
    })
    expect(change.remove.map((b) => b.id)).toEqual(['e1'])
    expect(dates(change.create)).toEqual(['2026-10-17', '2026-11-07']) // 10-24 و10-31 موجودان
    expect(change.keptEdited).toBe(1)
    expect(change.issues).toEqual([])
  })

  it('تعديل: وقت المحذوف يتحرّر فلا يتعارض الجديد مع القديم نفسه', () => {
    const change = planSeriesChange({
      series: { ...template, startTime: '17:15' }, // يتداخل مع 17:00–17:30 القديم
      services: [A],
      hours: HOURS,
      from: FROM,
      to: TO,
      now: NOW,
      existing,
      busy: busyOf(existing),
    })
    expect(change.create[0]).toMatchObject({
      date: '2026-10-17',
      startAt: z('2026-10-17T14:15:00Z'),
    })
    expect(change.issues).toEqual([])
  })

  it('تعديل: حجز زبون آخر في الوقت الجديد يبقى تعارضاً', () => {
    const other = { id: 'other', start: z('2026-11-07T14:00:00Z'), end: z('2026-11-07T15:00:00Z') }
    const change = planSeriesChange({
      series: template,
      services: [A],
      hours: HOURS,
      from: FROM,
      to: TO,
      now: NOW,
      existing,
      busy: [...busyOf(existing), other],
    })
    expect(change.issues).toEqual([{ date: '2026-11-07', k: 4, reason: 'CONFLICT' }])
  })

  it('إيقاف: يحذف القابل ولا يُنشئ شيئاً ويُبلغ بالمعدّل المتبقّي', () => {
    const change = planSeriesChange({
      series: { ...template, stopped: true },
      services: [A],
      hours: HOURS,
      from: FROM,
      to: TO,
      now: NOW,
      existing,
      busy: busyOf(existing),
    })
    expect(change.remove.map((b) => b.id)).toEqual(['e1'])
    expect(change.create).toEqual([])
    expect(change.keptEdited).toBe(1)
  })
})

describe('blocksHardDelete (D8)', () => {
  const live = { stoppedAt: null, endDate: null }
  const b = (occurrenceDate: string | null, recurringId: string | null = 'r1') => ({
    recurringId,
    occurrenceDate,
  })

  it('موعد دوري ضمن نطاق التوليد وسلسلة فعّالة ← ممنوع', () => {
    expect(blocksHardDelete(b('2026-10-17'), live, '2026-10-15')).toBe(true)
    expect(blocksHardDelete(b('2026-10-15'), live, '2026-10-15')).toBe(true) // أمس: حدّ المولّد
  })

  it('ماضٍ أقدم من نطاق التوليد ← مسموح', () => {
    expect(blocksHardDelete(b('2026-10-14'), live, '2026-10-15')).toBe(false)
  })

  it('سلسلة موقوفة ← مسموح', () => {
    const stopped = { stoppedAt: new Date(), endDate: null }
    expect(blocksHardDelete(b('2026-10-17'), stopped, '2026-10-15')).toBe(false)
  })

  it('بعد endDate ← مسموح (لن يُولَّد أصلاً)، وعند endDate ممنوع', () => {
    const ended = { stoppedAt: null, endDate: '2026-10-24' }
    expect(blocksHardDelete(b('2026-10-31'), ended, '2026-10-15')).toBe(false)
    expect(blocksHardDelete(b('2026-10-24'), ended, '2026-10-15')).toBe(true)
  })

  it('حجز عادي أو سلسلة محذوفة ← مسموح', () => {
    expect(blocksHardDelete(b(null, null), null, '2026-10-15')).toBe(false)
    expect(blocksHardDelete(b('2026-10-17'), null, '2026-10-15')).toBe(false)
  })
})
