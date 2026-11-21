import { ForbiddenException } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import type { BookingWithRelations } from './booking.mapper'
import {
  assertCanReopen,
  buildDaySummary,
  BookingCaps,
  capsOf,
  historyCutoff,
  resolveCompletion,
  toBookingView,
} from './booking.visibility'

const ADMIN: BookingCaps = { finance: true, history: true }
const STAFF: BookingCaps = { finance: false, history: false }

const booking = (over: Partial<BookingWithRelations> = {}): BookingWithRelations =>
  ({
    id: 'b1',
    serviceName: 'شعر',
    price: 25000,
    paidAmount: null,
    status: BookingStatus.ACTIVE,
    customer: { id: 'c1', name: 'زبون', phone: null },
    createdBy: null,
    ...over,
  }) as BookingWithRelations

describe('capsOf', () => {
  it('يقرأ الصلاحيتين من قائمة صلاحيات المستخدم', () => {
    expect(capsOf({ permissions: ['bookings.read'] })).toEqual(STAFF)
    expect(capsOf({ permissions: ['finance.read', 'bookings.history'] })).toEqual(ADMIN)
    expect(capsOf({ permissions: ['finance.read'] })).toEqual({ finance: true, history: false })
  })
})

describe('historyCutoff', () => {
  const tz = 'Asia/Damascus' // UTC+3

  it('بداية اليوم بتوقيت الصالون لا UTC', () => {
    // 2026-10-17 00:30 دمشق = 2026-10-16 21:30 UTC → بداية 17 = 16T21:00Z
    expect(historyCutoff(new Date('2026-10-16T21:30:00Z'), tz).toISOString()).toBe(
      '2026-10-16T21:00:00.000Z',
    )
  })

  it('قبل منتصف الليل بدقيقة لا يزال اليوم السابق', () => {
    // 2026-10-16 23:59 دمشق = 20:59 UTC → بداية 16 = 15T21:00Z
    expect(historyCutoff(new Date('2026-10-16T20:59:00Z'), tz).toISOString()).toBe(
      '2026-10-15T21:00:00.000Z',
    )
  })

  it('لحظة منتصف الليل بالضبط تبدأ يوماً جديداً', () => {
    expect(historyCutoff(new Date('2026-10-16T21:00:00Z'), tz).toISOString()).toBe(
      '2026-10-16T21:00:00.000Z',
    )
  })
})

describe('toBookingView', () => {
  it('المدير يرى الحقلين الماليين', () => {
    const view = toBookingView(booking({ paidAmount: 20000 }), ADMIN)
    expect(view.price).toBe(25000)
    expect(view.paidAmount).toBe(20000)
  })

  it('المشرف لا يستلم الحقلين أصلاً (المفتاح غائب لا null)', () => {
    const view = toBookingView(booking({ paidAmount: 20000 }), STAFF)
    expect(view).not.toHaveProperty('price')
    expect(view).not.toHaveProperty('paidAmount')
    expect(JSON.stringify(view)).not.toMatch(/25000|20000/)
    expect(view.serviceName).toBe('شعر')
  })

  it('startAlertSentAt حالة داخلية: لا تظهر لأي دور (المدير ولا المشرف)', () => {
    const withAlert = booking({ startAlertSentAt: new Date() } as never)
    expect(toBookingView(withAlert, ADMIN)).not.toHaveProperty('startAlertSentAt')
    expect(toBookingView(withAlert, STAFF)).not.toHaveProperty('startAlertSentAt')
  })

  it('لا يعدّل الكائن الأصلي', () => {
    const original = booking()
    toBookingView(original, STAFF)
    expect(original.price).toBe(25000)
  })
})

describe('buildDaySummary', () => {
  const rows = [
    { status: BookingStatus.COMPLETED, price: 10000, paidAmount: 9000 },
    { status: BookingStatus.COMPLETED, price: 5000, paidAmount: 5000 },
    { status: BookingStatus.ACTIVE, price: 7000, paidAmount: null },
    { status: BookingStatus.CANCELLED, price: 3000, paidAmount: null },
  ]

  it('المدير: العدّادات + الدخل والمتوقع', () => {
    expect(buildDaySummary(rows, ADMIN)).toEqual({
      total: 3,
      active: 1,
      completed: 2,
      cancelled: 1,
      revenue: 14000,
      expected: 7000,
    })
  })

  it('المشرف: العدّادات فقط بلا مفاتيح مالية', () => {
    const summary = buildDaySummary(rows, STAFF)
    expect(summary).toEqual({ total: 3, active: 1, completed: 2, cancelled: 1 })
    expect(summary).not.toHaveProperty('revenue')
    expect(summary).not.toHaveProperty('expected')
  })
})

describe('resolveCompletion (D11)', () => {
  it('المشرف بلا مبلغ: يُسجَّل سعر الحجز', () => {
    expect(
      resolveCompletion({ bookingPrice: 25000, servicePrice: 30000, requested: undefined }, STAFF),
    ).toEqual({ paidAmount: 25000, price: 25000 })
  })

  it('سعر حدّده المدير للحجز يتقدّم على سعر الخدمة', () => {
    expect(
      resolveCompletion({ bookingPrice: 18000, servicePrice: 25000, requested: undefined }, STAFF),
    ).toEqual({ paidAmount: 18000, price: 18000 })
  })

  it('سعر الحجز 0 (غير محدد): يُستعمل سعر الخدمة الحالي ويُحفظ على الحجز', () => {
    expect(
      resolveCompletion({ bookingPrice: 0, servicePrice: 25000, requested: undefined }, STAFF),
    ).toEqual({ paidAmount: 25000, price: 25000 })
  })

  it('سعر 0 وخدمة بلا سعر أو مؤرشفة: يبقى 0', () => {
    expect(
      resolveCompletion({ bookingPrice: 0, servicePrice: 0, requested: undefined }, STAFF),
    ).toEqual({ paidAmount: 0, price: 0 })
    expect(
      resolveCompletion({ bookingPrice: 0, servicePrice: null, requested: undefined }, STAFF),
    ).toEqual({ paidAmount: 0, price: 0 })
  })

  it('المشرف يُرفض إن أرسل مبلغاً (حتى لو مساوياً للسعر)', () => {
    for (const requested of [0, 25000, 99999]) {
      expect(() =>
        resolveCompletion({ bookingPrice: 25000, servicePrice: 25000, requested }, STAFF),
      ).toThrow(ForbiddenException)
    }
  })

  it('المدير: المبلغ الصريح يُسجَّل ولا يغيّر سعر الحجز', () => {
    expect(
      resolveCompletion({ bookingPrice: 25000, servicePrice: 25000, requested: 20000 }, ADMIN),
    ).toEqual({ paidAmount: 20000, price: 25000 })
  })

  it('المدير بلا مبلغ: نفس الافتراضي', () => {
    expect(
      resolveCompletion({ bookingPrice: 25000, servicePrice: 25000, requested: undefined }, ADMIN),
    ).toEqual({ paidAmount: 25000, price: 25000 })
  })
})

describe('assertCanReopen', () => {
  const completed = (paidAmount: number | null) =>
    booking({ status: BookingStatus.COMPLETED, price: 25000, paidAmount })

  it('المشرف يعيد فتح مكتمل لم يُعدَّل مبلغه', () => {
    expect(() => assertCanReopen(completed(25000), STAFF)).not.toThrow()
  })

  it('المشرف يُرفض إن عدّل المدير المبلغ', () => {
    expect(() => assertCanReopen(completed(20000), STAFF)).toThrow(ForbiddenException)
  })

  it('المشرف يعيد فتح ملغى', () => {
    expect(() => assertCanReopen(booking({ status: BookingStatus.CANCELLED }), STAFF)).not.toThrow()
  })

  it('المدير دائماً', () => {
    expect(() => assertCanReopen(completed(20000), ADMIN)).not.toThrow()
  })
})
