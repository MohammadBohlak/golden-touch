import type { SeriesTemplate } from './recurrence'
import { firstOccurrenceProblem, ISSUE_FIELD, validateTemplate } from './recurring.validation'

const template = (over: Partial<SeriesTemplate> = {}): SeriesTemplate => ({
  startDate: '2026-10-17',
  startTime: '17:00',
  intervalWeeks: 1,
  endDate: null,
  stopped: false,
  serviceIds: ['a'],
  ...over,
})
const run = (over: Partial<SeriesTemplate> = {}, checkStartRange = true, available = ['a']) =>
  validateTemplate({
    template: template(over),
    availableServiceIds: new Set(available),
    today: '2026-10-16',
    checkStartRange,
  })

describe('validateTemplate', () => {
  it('قالب سليم', () => {
    expect(run()).toEqual({})
  })

  it('تاريخ البداية: من اليوم وحتى 365 يوماً', () => {
    expect(run({ startDate: '2026-10-16' })).toEqual({})
    expect(run({ startDate: '2027-10-16' })).toEqual({}) // 365 يوماً بالضبط
    expect(run({ startDate: '2026-10-15' }).startDate).toBeDefined()
    expect(run({ startDate: '2027-10-17' }).startDate).toBeDefined()
  })

  it('لا يفحص النطاق إن لم يُطلب (تعديل سلسلة بدأت في الماضي)', () => {
    expect(run({ startDate: '2026-09-01' }, false)).toEqual({})
  })

  it('endDate: بعد البداية أو مساوٍ لها فقط', () => {
    expect(run({ endDate: '2026-10-17' })).toEqual({})
    expect(run({ endDate: '2026-10-16' }).endDate).toBeDefined()
  })

  it('كل الخدمات يجب أن تكون متاحة', () => {
    expect(run({ serviceIds: ['a', 'b'] }, true, ['a', 'b'])).toEqual({})
    expect(run({ serviceIds: ['a', 'b'] }).serviceIds).toBeDefined()
    expect(run({}, true, []).serviceIds).toBeDefined()
  })

  it('يجمع أكثر من خطأ', () => {
    expect(
      Object.keys(
        run({ startDate: '2026-10-01', endDate: '2026-09-01', serviceIds: ['z'] }),
      ).sort(),
    ).toEqual(['endDate', 'serviceIds', 'startDate'])
  })
})

describe('firstOccurrenceProblem', () => {
  const planned = (date: string) => ({
    date,
    k: 0,
    serviceId: 'a',
    startAt: new Date(),
    endAt: new Date(),
  })

  it('الموعد الأول يُنشأ ← لا مشكلة', () => {
    expect(
      firstOccurrenceProblem('2026-10-17', '2026-12-11', {
        create: [planned('2026-10-17')],
        issues: [],
      }),
    ).toBeNull()
  })

  it('مشكلة معروفة ← الحقل والرسالة من ISSUE_FIELD، والتداخل 409 وغيره 400', () => {
    for (const reason of Object.keys(ISSUE_FIELD) as (keyof typeof ISSUE_FIELD)[]) {
      const problem = firstOccurrenceProblem('2026-10-17', '2026-12-11', {
        create: [],
        issues: [{ date: '2026-10-17', k: 0, reason }],
      })
      expect(problem).toEqual({
        status: reason === 'CONFLICT' ? 409 : 400,
        ...ISSUE_FIELD[reason],
      })
    }
  })

  it('مشكلة في موعد آخر لا تهمّ', () => {
    expect(
      firstOccurrenceProblem('2026-10-17', '2026-12-11', {
        create: [planned('2026-10-17')],
        issues: [{ date: '2026-10-24', k: 1, reason: 'CONFLICT' }],
      }),
    ).toBeNull()
  })

  it('لا إنشاء ولا مشكلة داخل الأفق ← مضى', () => {
    expect(firstOccurrenceProblem('2026-10-17', '2026-12-11', { create: [], issues: [] })).toEqual({
      status: 400,
      field: 'startTime',
      message: 'الموعد الأول مضى، اختر وقتاً قادماً',
    })
  })

  it('خارج الأفق ← لا حكم', () => {
    expect(
      firstOccurrenceProblem('2027-01-01', '2026-12-11', { create: [], issues: [] }),
    ).toBeNull()
  })
})
