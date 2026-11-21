import {
  alertTitle,
  alertWindow,
  buildAlertPayload,
  createdInsideWindow,
  minutesUntil,
  MIN_TTL_SECONDS,
  ttlSeconds,
} from './push-alert.calc'

const NOW = new Date('2026-11-21T12:00:00.000Z')
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

describe('alertWindow', () => {
  it('من بعد دقيقة إلى N دقيقة', () => {
    const { from, to } = alertWindow(NOW, 15)
    expect(from).toEqual(at(1))
    expect(to).toEqual(at(15))
  })
})

describe('createdInsideWindow (D2)', () => {
  const startAt = at(10)

  it('حجز أُنشئ قبل أكثر من 15 دقيقة من بدايته: يُشعَر به', () => {
    expect(createdInsideWindow({ startAt, createdAt: at(-60) }, 15)).toBe(false)
    // أُنشئ قبل البداية بـ 15 دقيقة بالضبط: خارج النافذة (يُشعَر به)
    expect(createdInsideWindow({ startAt, createdAt: at(-5) }, 15)).toBe(false)
  })

  it('حجز أُنشئ قبل بدايته بأقل من 15 دقيقة: لا إشعار', () => {
    expect(createdInsideWindow({ startAt, createdAt: at(-4) }, 15)).toBe(true)
    expect(createdInsideWindow({ startAt, createdAt: at(9) }, 15)).toBe(true)
  })
})

describe('minutesUntil / ttlSeconds', () => {
  it('تقريب الدقائق وحدّ أدنى 1', () => {
    expect(minutesUntil(at(15), NOW)).toBe(15)
    expect(minutesUntil(at(5.6), NOW)).toBe(6)
    expect(minutesUntil(at(0.2), NOW)).toBe(1)
    expect(minutesUntil(at(-3), NOW)).toBe(1)
  })

  it('TTL = الثواني حتى البداية وبحدّ أدنى موجب تشترطه Apple', () => {
    expect(ttlSeconds(at(10), NOW)).toBe(600)
    expect(ttlSeconds(at(0.5), NOW)).toBe(MIN_TTL_SECONDS)
    expect(ttlSeconds(at(-5), NOW)).toBe(MIN_TTL_SECONDS)
  })
})

describe('alertTitle', () => {
  it.each([
    [1, 'موعد بعد دقيقة'],
    [2, 'موعد بعد دقيقتين'],
    [3, 'موعد بعد 3 دقائق'],
    [10, 'موعد بعد 10 دقائق'],
    [11, 'موعد بعد 11 دقيقة'],
    [15, 'موعد بعد 15 دقيقة'],
  ])('%i د ← %s', (minutes, title) => {
    expect(alertTitle(minutes)).toBe(title)
  })
})

describe('buildAlertPayload', () => {
  const booking = {
    id: 'b1',
    customerName: 'أحمد العلي',
    serviceName: 'قص شعر',
    // 13:30 UTC = 17:30 بتوقيت دبي (UTC+4 بلا توقيت صيفي، فالنتيجة ثابتة)
    startAt: new Date('2026-11-21T13:30:00.000Z'),
  }

  it('«الاسم · الخدمة · الوقت» بتوقيت الصالون وعنوان بالدقائق الفعلية', () => {
    const payload = buildAlertPayload(booking, new Date('2026-11-21T13:15:00.000Z'), 'Asia/Dubai')
    expect(payload.title).toBe('موعد بعد 15 دقيقة')
    expect(payload.body).toMatch(/^أحمد العلي · قص شعر · 5:30/)
    expect(payload.tag).toBe('booking-b1')
  })

  it('لا يحمل أي حقل مالي أو هاتف (مفاتيح الحمولة ثلاثة فقط)', () => {
    const payload = buildAlertPayload(booking, NOW, 'Asia/Dubai')
    expect(Object.keys(payload).sort()).toEqual(['body', 'tag', 'title'])
  })
})
