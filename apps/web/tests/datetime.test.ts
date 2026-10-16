import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addDays,
  dateInTz,
  endOfMonth,
  relativeDayLabel,
  startOfWeek,
  timeInTz,
  zonedToIso,
} from '../app/utils/datetime.ts'

describe('datetime utils', () => {
  it('converts shop-local time to UTC ISO', () => {
    assert.equal(zonedToIso('2026-10-16', '16:00', 'Asia/Damascus'), '2026-10-16T13:00:00.000Z')
  })

  it('reads dates and times in the shop timezone', () => {
    assert.equal(dateInTz('2026-10-16T22:30:00Z', 'Asia/Damascus'), '2026-10-17')
    assert.equal(timeInTz('2026-10-16T13:05:00Z', 'Asia/Damascus'), '16:05')
  })

  it('does calendar math', () => {
    assert.equal(addDays('2026-02-28', 1), '2026-03-01')
    assert.equal(startOfWeek('2026-10-16'), '2026-10-10')
    assert.equal(endOfMonth('2026-02-10'), '2026-02-28')
  })

  it('labels nearby days', () => {
    assert.equal(relativeDayLabel('2026-10-16', '2026-10-16'), 'اليوم')
    assert.equal(relativeDayLabel('2026-10-17', '2026-10-16'), 'غداً')
    assert.equal(relativeDayLabel('2026-10-15', '2026-10-16'), 'أمس')
  })
})
