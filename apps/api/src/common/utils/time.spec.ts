import {
  addDays,
  dayRangeUtc,
  diffDays,
  isValidDateString,
  toDateString,
  tzOffsetMinutes,
  weekdayOf,
  zonedToUtc,
} from './time'

const TZ = 'Asia/Damascus' // UTC+3 طوال السنة منذ 2022

describe('time utils', () => {
  it('computes the Damascus offset', () => {
    expect(tzOffsetMinutes(new Date('2026-10-16T12:00:00Z'), TZ)).toBe(180)
  })

  it('converts shop-local time to UTC', () => {
    expect(zonedToUtc('2026-10-16', 10 * 60, TZ).toISOString()).toBe('2026-10-16T07:00:00.000Z')
  })

  it('supports minutes past midnight (late closing)', () => {
    expect(zonedToUtc('2026-10-16', 25 * 60, TZ).toISOString()).toBe('2026-10-16T22:00:00.000Z')
  })

  it('handles DST zones', () => {
    // برلين: توقيت صيفي +2 في تموز، +1 في كانون الثاني
    expect(zonedToUtc('2026-07-01', 12 * 60, 'Europe/Berlin').toISOString()).toBe(
      '2026-07-01T10:00:00.000Z',
    )
    expect(zonedToUtc('2026-01-01', 12 * 60, 'Europe/Berlin').toISOString()).toBe(
      '2026-01-01T11:00:00.000Z',
    )
  })

  it('gets the shop-local calendar date', () => {
    // 22:30 UTC = 01:30 في دمشق من اليوم التالي
    expect(toDateString(new Date('2026-10-16T22:30:00Z'), TZ)).toBe('2026-10-17')
  })

  it('builds full-day ranges', () => {
    const { start, end } = dayRangeUtc('2026-10-16', TZ)
    expect(start.toISOString()).toBe('2026-10-15T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-16T21:00:00.000Z')
  })

  it('does date arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30)
    expect(weekdayOf('2026-10-16')).toBe(5) // جمعة
  })

  it('validates date strings', () => {
    expect(isValidDateString('2026-02-29')).toBe(false)
    expect(isValidDateString('2028-02-29')).toBe(true)
    expect(isValidDateString('16-10-2026')).toBe(false)
  })
})
