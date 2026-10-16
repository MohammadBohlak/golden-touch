import { computeGaps, computeSlots, overlaps, shopWindow } from './schedule'

const at = (hhmm: string) => new Date(`2026-10-16T${hhmm}:00.000Z`)

describe('schedule', () => {
  describe('overlaps', () => {
    it('treats touching intervals as free (end is exclusive)', () => {
      // حجز 4:00–5:00 لا يمنع حجزاً يبدأ 5:00
      expect(
        overlaps(
          { start: at('16:00'), end: at('17:00') },
          { start: at('17:00'), end: at('17:30') },
        ),
      ).toBe(false)
    })

    it('detects partial overlap', () => {
      expect(
        overlaps(
          { start: at('16:00'), end: at('17:00') },
          { start: at('16:30'), end: at('17:30') },
        ),
      ).toBe(true)
    })
  })

  describe('shopWindow', () => {
    it('builds the window in shop time', () => {
      const w = shopWindow('2026-10-16', {
        openTime: '10:00',
        closeTime: '22:00',
        daysOff: [],
        timezone: 'Asia/Damascus',
      })
      expect(w.start.toISOString()).toBe('2026-10-16T07:00:00.000Z')
      expect(w.end.toISOString()).toBe('2026-10-16T19:00:00.000Z')
      expect(w.closed).toBe(false)
    })

    it('extends past midnight and flags days off', () => {
      const w = shopWindow('2026-10-16', {
        openTime: '14:00',
        closeTime: '01:00',
        daysOff: [5],
        timezone: 'Asia/Damascus',
      })
      expect(w.end.toISOString()).toBe('2026-10-16T22:00:00.000Z')
      expect(w.closed).toBe(true)
    })
  })

  describe('computeSlots', () => {
    const window = { start: at('14:00'), end: at('17:00') }
    const busy = [{ id: 'b1', start: at('15:00'), end: at('16:00') }]

    it('marks booked, conflicting and available start times', () => {
      const slots = computeSlots({
        window,
        busy,
        durationMinutes: 60,
        stepMinutes: 30,
        now: at('08:00'),
      })
      const states = Object.fromEntries(
        slots.map((s) => [s.start.toISOString().slice(11, 16), s.state]),
      )
      expect(states).toEqual({
        '14:00': 'available',
        '14:30': 'conflict', // 14:30–15:30 يتداخل مع الحجز
        '15:00': 'booked',
        '15:30': 'booked',
        '16:00': 'available',
        '16:30': 'conflict', // يتجاوز نهاية الدوام
      })
      expect(slots.find((s) => s.state === 'booked')?.bookingId).toBe('b1')
    })

    it('marks elapsed slots as past but keeps the current one open', () => {
      const slots = computeSlots({
        window,
        busy: [],
        durationMinutes: 30,
        stepMinutes: 30,
        now: at('14:40'),
      })
      expect(slots[0].state).toBe('past') // 14:00 انتهت خطوتها
      expect(slots[1].state).toBe('available') // 14:30 ما زالت جارية
    })
  })

  describe('computeGaps', () => {
    it('returns free gaps around bookings and splits at now', () => {
      const gaps = computeGaps({
        window: { start: at('14:00'), end: at('18:00') },
        busy: [
          { start: at('15:00'), end: at('16:00') },
          { start: at('16:00'), end: at('16:30') },
        ],
        now: at('14:32'),
      })
      expect(
        gaps.map((g) => [
          g.start.toISOString().slice(11, 16),
          g.end.toISOString().slice(11, 16),
          g.past,
        ]),
      ).toEqual([
        ['14:00', '14:32', true],
        ['14:35', '15:00', false],
        ['16:30', '18:00', false],
      ])
      expect(gaps[2].minutes).toBe(90)
    })

    it('ignores bookings outside the window', () => {
      const gaps = computeGaps({
        window: { start: at('14:00'), end: at('15:00') },
        busy: [{ start: at('10:00'), end: at('11:00') }],
        now: at('08:00'),
      })
      expect(gaps).toHaveLength(1)
      expect(gaps[0].minutes).toBe(60)
    })
  })
})
