import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import type { AuthUser } from '../../common/types/auth-user'
import type { PrismaService } from '../../prisma/prisma.service'
import type { SettingsService } from '../settings/settings.service'
import { BookingsService } from './bookings.service'

/**
 * سلوك الخدمة مع Prisma وهمي: نتحقق من الاستعلامات الفعلية لا من القيم المُرجَعة فقط.
 * "الآن" ثابت = 2026-10-16 15:00 بتوقيت دمشق → بداية اليوم (cutoff) = 2026-10-15T21:00Z.
 */
const NOW = new Date('2026-10-16T12:00:00Z')
const CUTOFF = new Date('2026-10-15T21:00:00Z')

const settings = {
  shopName: 'Golden Touch',
  openTime: '10:00',
  closeTime: '22:00',
  slotMinutes: 15,
  timezone: 'Asia/Damascus',
  daysOff: [] as number[],
}

const user = (permissions: string[]): AuthUser => ({
  id: 'u1',
  name: 'مستخدم',
  email: 'u@x.test',
  phone: null,
  role: { id: 1, name: 'x', label: 'x' },
  permissions,
})
const STAFF = user(['bookings.read', 'bookings.create', 'bookings.update', 'bookings.complete'])
const ADMIN = user([...STAFF.permissions, 'finance.read', 'bookings.history'])

const row = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  customerId: 'c1',
  serviceId: 's1',
  serviceName: 'شعر',
  price: 25000,
  paidAmount: null,
  durationMinutes: 30,
  startAt: new Date('2026-10-16T13:00:00Z'),
  endAt: new Date('2026-10-16T13:30:00Z'),
  status: BookingStatus.ACTIVE,
  customer: { id: 'c1', name: 'زبون', phone: null },
  createdBy: null,
  ...over,
})

function setup() {
  // `tx` داخل $transaction هو نفس الكائن (نفس الدوال الوهمية) كي تُرى الاستدعاءات
  const base = {
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn(),
    },
    service: { findUnique: jest.fn(), findFirst: jest.fn() },
    customer: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
  }
  const prisma = {
    ...base,
    $queryRaw: jest.fn(),
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(base),
    ),
  }
  const settingsService = { get: jest.fn().mockResolvedValue(settings) }
  const service = new BookingsService(
    prisma as unknown as PrismaService,
    settingsService as unknown as SettingsService,
  )
  return { service, prisma }
}

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(NOW)
})
afterAll(() => {
  jest.useRealTimers()
})

describe('BookingsService — نطاق الرؤية', () => {
  describe('day', () => {
    it('المشرف: يوم سابق → 403 دون أي استعلام', async () => {
      const { service, prisma } = setup()
      await expect(service.day('2026-10-15', STAFF)).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.booking.findMany).not.toHaveBeenCalled()
    })

    it('المشرف: اليوم → حجوزات بلا مال وملخص بلا دخل', async () => {
      const { service, prisma } = setup()
      prisma.booking.findMany.mockResolvedValue([
        row(),
        row({ id: 'b2', status: BookingStatus.COMPLETED, paidAmount: 25000 }),
      ])
      const result = await service.day('2026-10-16', STAFF)
      expect(result.bookings).toHaveLength(2)
      for (const b of result.bookings) {
        expect(b).not.toHaveProperty('price')
        expect(b).not.toHaveProperty('paidAmount')
      }
      expect(result.summary).toEqual({ total: 2, active: 1, completed: 1, cancelled: 0 })
      expect(JSON.stringify(result)).not.toContain('25000')
    })

    it('المدير: يوم سابق مسموح ومعه الدخل', async () => {
      const { service, prisma } = setup()
      prisma.booking.findMany.mockResolvedValue([
        row({ status: BookingStatus.COMPLETED, paidAmount: 20000 }),
      ])
      const result = await service.day('2026-10-10', ADMIN)
      expect(result.summary.revenue).toBe(20000)
      expect(result.bookings[0].price).toBe(25000)
    })
  })

  describe('findAll', () => {
    const lastWhere = (prisma: ReturnType<typeof setup>['prisma']) =>
      (prisma.booking.findMany.mock.calls[0] as [{ where: { startAt?: { gte?: Date } } }])[0].where

    it('المشرف بلا فلتر: الحدّ الأدنى = بداية اليوم', async () => {
      const { service, prisma } = setup()
      await service.findAll({ skip: 0, limit: 15 } as never, STAFF)
      expect(lastWhere(prisma).startAt?.gte).toEqual(CUTOFF)
    })

    it('المشرف يطلب from قديماً → لا ينزل تحت بداية اليوم', async () => {
      const { service, prisma } = setup()
      await service.findAll({ skip: 0, limit: 15, from: '2026-01-01' } as never, STAFF)
      expect(lastWhere(prisma).startAt?.gte).toEqual(CUTOFF)
    })

    it('المشرف يطلب سجل زبون سابقاً (customerId + to قديم) → الحدّ الأدنى باقٍ فلا نتائج', async () => {
      const { service, prisma } = setup()
      await service.findAll(
        { skip: 0, limit: 15, customerId: 'c1', to: '2026-09-01' } as never,
        STAFF,
      )
      const where = lastWhere(prisma) as { startAt: { gte: Date; lt: Date } }
      expect(where.startAt.gte).toEqual(CUTOFF)
      expect(where.startAt.lt.getTime()).toBeLessThan(CUTOFF.getTime()) // نطاق فارغ
    })

    it('المشرف يطلب from مستقبلياً → يُحترم', async () => {
      const { service, prisma } = setup()
      await service.findAll({ skip: 0, limit: 15, from: '2026-10-20' } as never, STAFF)
      expect(lastWhere(prisma).startAt?.gte?.getTime()).toBeGreaterThan(CUTOFF.getTime())
    })

    it('المدير بلا فلتر: لا حدّ زمني', async () => {
      const { service, prisma } = setup()
      await service.findAll({ skip: 0, limit: 15 } as never, ADMIN)
      expect(lastWhere(prisma).startAt).toBeUndefined()
    })

    it('المشرف: عناصر الصفحة بلا مال', async () => {
      const { service, prisma } = setup()
      prisma.booking.findMany.mockResolvedValue([row()])
      const result = await service.findAll({ skip: 0, limit: 15 } as never, STAFF)
      expect(result.items[0]).not.toHaveProperty('price')
    })
  })

  describe('overdue', () => {
    it('المشرف: يُقيَّد ببداية اليوم؛ المدير بلا قيد', async () => {
      const { service, prisma } = setup()
      await service.overdue(STAFF)
      await service.overdue(ADMIN)
      const [staffCall, adminCall] = prisma.booking.findMany.mock.calls as Array<
        [{ where: { startAt?: { gte: Date } } }]
      >
      expect(staffCall[0].where.startAt?.gte).toEqual(CUTOFF)
      expect(adminCall[0].where.startAt).toBeUndefined()
    })
  })

  describe('findOne', () => {
    it('المشرف: حجز سابق → 404 (لا يكشف وجوده)', async () => {
      const { service, prisma } = setup()
      prisma.booking.findUnique.mockResolvedValue(
        row({ startAt: new Date('2026-10-15T10:00:00Z'), endAt: new Date('2026-10-15T10:30:00Z') }),
      )
      await expect(service.findOne('b1', STAFF)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('المدير: الحجز السابق يظهر', async () => {
      const { service, prisma } = setup()
      prisma.booking.findUnique.mockResolvedValue(
        row({ startAt: new Date('2026-10-15T10:00:00Z'), endAt: new Date('2026-10-15T10:30:00Z') }),
      )
      await expect(service.findOne('b1', ADMIN)).resolves.toMatchObject({ price: 25000 })
    })
  })
})

describe('BookingsService — تأكيد الحجز (D11)', () => {
  it('المشرف بلا مبلغ: يُسجَّل سعر الحجز ولا يظهر المبلغ في الاستجابة', async () => {
    const { service, prisma } = setup()
    prisma.booking.findUnique.mockResolvedValue(row({ price: 18000 })) // سعر خصّصه المدير
    prisma.service.findUnique.mockResolvedValue({ price: 25000 })
    prisma.booking.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row({ ...data })),
    )
    const result = await service.complete('b1', {}, STAFF)

    const [{ data }] = prisma.booking.update.mock.calls[0] as [{ data: Record<string, unknown> }]
    expect(data).toMatchObject({ status: BookingStatus.COMPLETED, paidAmount: 18000, price: 18000 })
    expect(result.status).toBe(BookingStatus.COMPLETED)
    expect(result).not.toHaveProperty('paidAmount')
    expect(result).not.toHaveProperty('price')
  })

  it('سعر الحجز 0: يُستعمل سعر الخدمة الحالي', async () => {
    const { service, prisma } = setup()
    prisma.booking.findUnique.mockResolvedValue(row({ price: 0 }))
    prisma.service.findUnique.mockResolvedValue({ price: 25000 })
    prisma.booking.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row({ ...data })),
    )
    await service.complete('b1', {}, STAFF)
    const [{ data }] = prisma.booking.update.mock.calls[0] as [{ data: Record<string, unknown> }]
    expect(data).toMatchObject({ paidAmount: 25000, price: 25000 })
  })

  it('المشرف يرسل مبلغاً → 403 ولا كتابة', async () => {
    const { service, prisma } = setup()
    await expect(service.complete('b1', { paidAmount: 1 }, STAFF)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(prisma.booking.update).not.toHaveBeenCalled()
  })

  it('المشرف لا يؤكد حجزاً سابقاً (404)', async () => {
    const { service, prisma } = setup()
    prisma.booking.findUnique.mockResolvedValue(
      row({ startAt: new Date('2026-10-14T10:00:00Z'), endAt: new Date('2026-10-14T10:30:00Z') }),
    )
    await expect(service.complete('b1', {}, STAFF)).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.booking.update).not.toHaveBeenCalled()
  })

  it('المدير بمبلغ صريح: يُسجَّل كما هو ويرى النتيجة', async () => {
    const { service, prisma } = setup()
    prisma.booking.findUnique.mockResolvedValue(row())
    prisma.service.findUnique.mockResolvedValue({ price: 25000 })
    prisma.booking.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row({ ...data })),
    )
    const result = await service.complete('b1', { paidAmount: 20000 }, ADMIN)
    expect(result.paidAmount).toBe(20000)
    expect(result.price).toBe(25000)
  })
})

describe('BookingsService — الكتابة', () => {
  const dto = (over: Record<string, unknown> = {}) =>
    ({
      serviceId: 's1',
      startAt: '2026-10-16T14:00:00.000Z',
      customerName: 'زبون',
      ...over,
    }) as never

  it('المشرف لا يحدّد سعراً عند الإنشاء (403)', async () => {
    const { service, prisma } = setup()
    await expect(service.create(dto({ price: 5 }), STAFF)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(prisma.booking.create).not.toHaveBeenCalled()
  })

  it('المشرف لا ينشئ حجزاً في تاريخ سابق (403)', async () => {
    const { service } = setup()
    await expect(
      service.create(dto({ startAt: '2026-10-15T10:00:00.000Z' }), STAFF),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('المشرف لا يعدّل السعر ولا المبلغ (403)', async () => {
    const { service } = setup()
    await expect(service.update('b1', { price: 1 } as never, STAFF)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    await expect(service.update('b1', { paidAmount: 1 } as never, STAFF)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('المشرف لا ينقل حجزاً إلى تاريخ سابق (403)', async () => {
    const { service } = setup()
    await expect(
      service.update('b1', { startAt: '2026-10-10T10:00:00.000Z' } as never, STAFF),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('إنشاء المشرف يحفظ سعر الخدمة الافتراضي ولا يعيده له', async () => {
    const { service, prisma } = setup()
    prisma.service.findFirst.mockResolvedValue({
      id: 's1',
      name: 'شعر',
      price: 25000,
      durationMinutes: 30,
    })
    prisma.booking.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row({ ...data })),
    )
    const result = await service.create(dto(), STAFF)
    const [{ data }] = prisma.booking.create.mock.calls[0] as [{ data: Record<string, unknown> }]
    expect(data.price).toBe(25000)
    expect(result).not.toHaveProperty('price')
  })
})

describe('BookingsService — الحجوزات الدورية', () => {
  const recurringRow = (over: Record<string, unknown> = {}) =>
    row({
      recurringId: 'r1',
      occurrenceDate: new Date('2026-10-17T00:00:00Z'),
      recurring: { stoppedAt: null, endDate: null },
      ...over,
    })

  describe('update', () => {
    it('تعديل موعد دوري يضع recurringEdited فلا تعيد كتابته تعديلات السلسلة', async () => {
      const { service, prisma } = setup()
      prisma.booking.findUnique.mockResolvedValue(recurringRow())
      prisma.booking.update.mockResolvedValue(recurringRow())
      await service.update('b1', { notes: 'x' } as never, STAFF)
      const [{ data }] = prisma.booking.update.mock.calls[0] as [{ data: Record<string, unknown> }]
      expect(data.recurringEdited).toBe(true)
    })

    it('الحجز العادي لا يُعلَّم', async () => {
      const { service, prisma } = setup()
      prisma.booking.findUnique.mockResolvedValue(row())
      prisma.booking.update.mockResolvedValue(row())
      await service.update('b1', { notes: 'x' } as never, STAFF)
      const [{ data }] = prisma.booking.update.mock.calls[0] as [{ data: Record<string, unknown> }]
      expect(data).not.toHaveProperty('recurringEdited')
    })
  })

  describe('remove (D8)', () => {
    const run = (found: unknown) => {
      const { service, prisma } = setup()
      prisma.booking.findUnique.mockResolvedValue(found)
      const del = jest.fn().mockResolvedValue({})
      Object.assign(prisma.booking, { delete: del })
      return { service, del }
    }

    it('موعد دوري قادم لسلسلة فعّالة ← 409 ولا حذف', async () => {
      const { service, del } = run(recurringRow())
      await expect(service.remove('b1')).rejects.toBeInstanceOf(ConflictException)
      expect(del).not.toHaveBeenCalled()
    })

    it('سلسلة موقوفة ← يُحذف', async () => {
      const { service, del } = run(
        recurringRow({ recurring: { stoppedAt: new Date(), endDate: null } }),
      )
      await expect(service.remove('b1')).resolves.toEqual({ success: true })
      expect(del).toHaveBeenCalledWith({ where: { id: 'b1' } })
    })

    it('موعد دوري ماضٍ (قبل أمس) ← يُحذف', async () => {
      const { service, del } = run(
        recurringRow({ occurrenceDate: new Date('2026-10-10T00:00:00Z') }),
      )
      await service.remove('b1')
      expect(del).toHaveBeenCalled()
    })

    it('حجز عادي ← يُحذف', async () => {
      const { service, del } = run(
        row({ recurringId: null, occurrenceDate: null, recurring: null }),
      )
      await service.remove('b1')
      expect(del).toHaveBeenCalled()
    })

    it('غير موجود ← 404', async () => {
      const { service } = run(null)
      await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  it('findAll: فلتر recurringId يصل إلى where', async () => {
    const { service, prisma } = setup()
    await service.findAll({ skip: 0, limit: 15, recurringId: 'r1' } as never, ADMIN)
    const [{ where }] = prisma.booking.findMany.mock.calls[0] as [
      { where: { recurringId?: string } },
    ]
    expect(where.recurringId).toBe('r1')
  })
})

describe('BookingsService.findAll — البحث بتوحيد الحروف العربية', () => {
  it('معرّفات الزبائن وأسماء الخدمات المطابقة تدخل في where مع شرط الهاتف', async () => {
    const { service, prisma } = setup()
    ;(prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw
      .mockResolvedValueOnce([{ id: 'c1' }])
      .mockResolvedValueOnce([{ value: 'حلاقة شعر' }])
    await service.findAll({ skip: 0, limit: 15, search: 'احمد' } as never, ADMIN)
    const [{ where }] = prisma.booking.findMany.mock.calls[0] as [{ where: { OR: unknown[] } }]
    expect(where.OR).toEqual([
      { customerId: { in: ['c1'] } },
      { serviceName: { in: ['حلاقة شعر'] } },
    ])
  })
})
