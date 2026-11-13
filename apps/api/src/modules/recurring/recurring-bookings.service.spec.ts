import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import type { AuthUser } from '../../common/types/auth-user'
import type { PrismaService } from '../../prisma/prisma.service'
import type { SettingsService } from '../settings/settings.service'
import { RecurringBookingsService } from './recurring-bookings.service'
import type { RecurringService } from './recurring.service'

/** "الآن" = 2026-10-16 15:00 دمشق (جمعة) → اليوم 2026-10-16، الأفق حتى 2026-12-11 */
const NOW = new Date('2026-10-16T12:00:00Z')

const user = (permissions: string[]): AuthUser => ({
  id: 'u1',
  name: 'مستخدم',
  email: 'u@x.test',
  phone: null,
  role: { id: 1, name: 'x', label: 'x' },
  permissions,
})
const STAFF = user(['recurring.read', 'recurring.manage'])
const ADMIN = user([...STAFF.permissions, 'finance.read', 'bookings.history'])

const ctx = (over: Record<string, unknown> = {}) => ({
  hours: { openTime: '10:00', closeTime: '22:00', daysOff: [], timezone: 'Asia/Damascus' },
  services: [
    { id: 's1', name: 'شعر', durationMinutes: 30, available: true },
    { id: 's2', name: 'لحية', durationMinutes: 45, available: true },
  ],
  rows: new Map(),
  from: '2026-10-15',
  to: '2026-12-11',
  ...over,
})

const seriesRow = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  customerId: 'c1',
  customer: { id: 'c1', name: 'زبون', phone: '0991234567' },
  startDate: new Date('2026-10-17T00:00:00Z'),
  startTime: '17:00',
  intervalWeeks: 2,
  endDate: null,
  notes: null,
  stoppedAt: null,
  createdById: 'u1',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  services: [
    { recurringId: 'r1', position: 0, serviceId: 's1' },
    { recurringId: 'r1', position: 1, serviceId: 's2' },
  ],
  ...over,
})

const upcomingBooking = {
  id: 'b1',
  customerId: 'c1',
  serviceId: 's1',
  serviceName: 'شعر',
  price: 25000,
  paidAmount: null,
  durationMinutes: 30,
  startAt: new Date('2026-10-17T14:00:00Z'),
  endAt: new Date('2026-10-17T14:30:00Z'),
  status: BookingStatus.ACTIVE,
  recurringId: 'r1',
  occurrenceDate: new Date('2026-10-17T00:00:00Z'),
  customer: { id: 'c1', name: 'زبون', phone: null },
  createdBy: null,
}

const noChange = { create: [], remove: [], issues: [], keptEdited: 0 }

function setup(opts: { series?: unknown; ctx?: unknown } = {}) {
  const prisma = {
    customer: { count: jest.fn().mockResolvedValue(1) },
    recurringBooking: {
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      findMany: jest.fn().mockResolvedValue([seriesRow()]),
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.series === undefined ? seriesRow() : opts.series),
    },
    booking: {
      findMany: jest.fn((args: { select?: unknown }): Promise<unknown[]> =>
        Promise.resolve(args.select ? [] : [upcomingBooking]),
      ),
    },
    service: {
      findMany: jest.fn().mockResolvedValue([
        { id: 's1', name: 'شعر', durationMinutes: 30 },
        { id: 's2', name: 'لحية', durationMinutes: 45 },
      ]),
    },
  }
  const engine = {
    loadContext: jest.fn().mockResolvedValue(opts.ctx ?? ctx()),
    loadSeries: jest.fn().mockResolvedValue(opts.series === undefined ? seriesRow() : opts.series),
    preview: jest.fn().mockResolvedValue(noChange),
    generate: jest.fn().mockResolvedValue({ created: 4, issues: [] }),
    replaceFuture: jest
      .fn()
      .mockResolvedValue({ removed: 2, created: 3, issues: [], keptEdited: 1 }),
    stop: jest.fn().mockResolvedValue({ removed: 3, keptEdited: 1 }),
    fillPlans: jest.fn().mockResolvedValue({ plans: new Map() }),
  }
  const settings = { get: jest.fn().mockResolvedValue({ timezone: 'Asia/Damascus' }) }
  const service = new RecurringBookingsService(
    prisma as unknown as PrismaService,
    settings as unknown as SettingsService,
    engine as unknown as RecurringService,
  )
  return { service, prisma, engine }
}

const create = (over: Record<string, unknown> = {}) =>
  ({
    customerId: 'c1',
    startDate: '2026-10-17',
    startTime: '17:00',
    intervalWeeks: 2,
    serviceIds: ['s1', 's2'],
    ...over,
  }) as never

async function errorsOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return (error as BadRequestException).getResponse() as {
      message: string
      errors: Record<string, string[]>
    }
  }
  throw new Error('expected rejection')
}

describe('RecurringBookingsService.create', () => {
  it('زبون غير موجود ← 404 ولا كتابة', async () => {
    const { service, prisma } = setup()
    prisma.customer.count.mockResolvedValue(0)
    await expect(service.create(create(), STAFF, NOW)).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.recurringBooking.create).not.toHaveBeenCalled()
  })

  it('خدمة غير متاحة ← 400 على serviceIds', async () => {
    const { service, prisma } = setup({
      ctx: ctx({ services: [{ id: 's1', name: 'شعر', durationMinutes: 30, available: false }] }),
    })
    const body = await errorsOf(service.create(create({ serviceIds: ['s1'] }), STAFF, NOW))
    expect(body.errors.serviceIds).toHaveLength(1)
    expect(prisma.recurringBooking.create).not.toHaveBeenCalled()
  })

  it('تاريخ بداية سابق أو بعد أكثر من سنة ← 400 على startDate', async () => {
    const { service } = setup()
    for (const startDate of ['2026-10-15', '2027-10-18']) {
      const body = await errorsOf(service.create(create({ startDate }), STAFF, NOW))
      expect(body.errors.startDate).toBeDefined()
    }
  })

  it('endDate قبل البداية ← 400', async () => {
    const { service } = setup()
    const body = await errorsOf(service.create(create({ endDate: '2026-10-10' }), STAFF, NOW))
    expect(body.errors.endDate).toBeDefined()
  })

  it.each([
    ['CONFLICT', ConflictException, 'startTime'],
    ['OUTSIDE_HOURS', BadRequestException, 'startTime'],
    ['CLOSED', BadRequestException, 'startDate'],
    ['SERVICE_UNAVAILABLE', BadRequestException, 'serviceIds'],
  ])('تعذّر الموعد الأول (%s) ← رفض بالحقل الصحيح ولا كتابة', async (reason, ErrorClass, field) => {
    const { service, engine, prisma } = setup()
    engine.preview.mockResolvedValue({
      ...noChange,
      issues: [{ date: '2026-10-17', k: 0, reason }],
    })
    const promise = service.create(create(), STAFF, NOW)
    await expect(promise).rejects.toBeInstanceOf(ErrorClass)
    const body = await errorsOf(service.create(create(), STAFF, NOW))
    expect(Object.keys(body.errors)).toEqual([field])
    expect(prisma.recurringBooking.create).not.toHaveBeenCalled()
  })

  it('الموعد الأول مضى (لا يُنشأ ولا مشكلة) ← 400', async () => {
    const { service } = setup()
    const body = await errorsOf(
      service.create(create({ startDate: '2026-10-16', startTime: '10:00' }), STAFF, NOW),
    )
    expect(body.errors.startTime).toEqual(['الموعد الأول مضى، اختر وقتاً قادماً'])
  })

  it('بداية بعد أفق التوليد ← لا حكم على الموعد الأول وتُنشأ السلسلة', async () => {
    const { service, prisma } = setup()
    await service.create(create({ startDate: '2027-01-01' }), STAFF, NOW)
    expect(prisma.recurringBooking.create).toHaveBeenCalled()
  })

  it('نجاح: صف السلسلة بتناوبها ومنشئها، ثم التوليد، والاستجابة بلا مال للمشرف', async () => {
    const { service, prisma, engine } = setup()
    engine.preview.mockResolvedValue({
      ...noChange,
      create: [{ date: '2026-10-17', k: 0, serviceId: 's1' }],
    })
    const result = await service.create(create({ notes: 'قصة قصيرة' }), STAFF, NOW)

    expect(prisma.recurringBooking.create).toHaveBeenCalledWith({
      data: {
        customerId: 'c1',
        startTime: '17:00',
        startDate: new Date('2026-10-17T00:00:00Z'),
        intervalWeeks: 2,
        endDate: null,
        notes: 'قصة قصيرة',
        createdById: 'u1',
        services: {
          create: [
            { serviceId: 's1', position: 0 },
            { serviceId: 's2', position: 1 },
          ],
        },
      },
      select: { id: true },
    })
    expect(engine.generate).toHaveBeenCalledWith('r1', NOW)
    expect(result).toMatchObject({ created: 4, removed: 0, keptEdited: 0 })
    expect(result.series.upcoming).toHaveLength(1)
    const json = JSON.stringify(result)
    expect(json).not.toContain('"price"')
    expect(json).not.toContain('"paidAmount"')
  })

  it('المدير (finance.read): حجوزات السلسلة المرفقة بأسعارها، والقالب بلا مال', async () => {
    const { service, engine } = setup()
    engine.preview.mockResolvedValue({
      ...noChange,
      create: [{ date: '2026-10-17', k: 0, serviceId: 's1' }],
    })
    const result = await service.create(create(), ADMIN, NOW)
    expect(result.series.upcoming[0].price).toBe(25000)
    expect(Object.keys(result.series)).not.toContain('price')
  })

  it('فشل التوليد لا يُسقط الطلب (تسدّه المزامنة)', async () => {
    const { service, engine } = setup()
    engine.preview.mockResolvedValue({
      ...noChange,
      create: [{ date: '2026-10-17', k: 0, serviceId: 's1' }],
    })
    engine.generate.mockRejectedValue(new Error('db hiccup'))
    await expect(service.create(create(), STAFF, NOW)).resolves.toMatchObject({ created: 0 })
  })
})

describe('RecurringBookingsService.update', () => {
  it('سلسلة موقوفة ← 409', async () => {
    const { service, engine } = setup({ series: seriesRow({ stoppedAt: new Date() }) })
    await expect(
      service.update('r1', { startTime: '18:00' } as never, STAFF, NOW),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(engine.replaceFuture).not.toHaveBeenCalled()
  })

  it('يحوّل الحقول: endDate: null يمسح، notes فارغة تصير null، وغير المذكور undefined', async () => {
    const { service, engine } = setup()
    const result = await service.update(
      'r1',
      { startTime: '18:00', endDate: null, notes: '' } as never,
      STAFF,
      NOW,
    )
    expect(engine.replaceFuture).toHaveBeenCalledWith(
      'r1',
      {
        customerId: undefined,
        startDate: undefined,
        startTime: '18:00',
        intervalWeeks: undefined,
        endDate: null,
        serviceIds: undefined,
        notes: null,
      },
      NOW,
    )
    expect(result).toMatchObject({ created: 3, removed: 2, keptEdited: 1 })
  })

  it('لا يتحقق من نطاق startDate إن لم يتغيّر (سلسلة بدأت في الماضي تُعدَّل)', async () => {
    const { service } = setup({
      series: seriesRow({ startDate: new Date('2026-09-05T00:00:00Z') }),
    })
    await expect(
      service.update('r1', { startTime: '18:00' } as never, STAFF, NOW),
    ).resolves.toBeDefined()
  })

  it('تغيير startDate إلى الماضي ← 400', async () => {
    const { service } = setup()
    const body = await errorsOf(
      service.update('r1', { startDate: '2026-10-10' } as never, STAFF, NOW),
    )
    expect(body.errors.startDate).toBeDefined()
  })

  it('زبون جديد غير موجود ← 404', async () => {
    const { service, prisma } = setup()
    prisma.customer.count.mockResolvedValue(0)
    await expect(
      service.update('r1', { customerId: 'c9' } as never, STAFF, NOW),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('RecurringBookingsService.stop', () => {
  it('يفوّض للمحرّك ويعيد الأعداد', async () => {
    const { service, engine } = setup()
    const result = await service.stop('r1', STAFF, NOW)
    expect(engine.stop).toHaveBeenCalledWith('r1', NOW)
    expect(result).toMatchObject({ created: 0, removed: 3, keptEdited: 1 })
  })
})

describe('RecurringBookingsService.preview', () => {
  it('سلسلة جديدة بلا الحقول الأساسية ← 400 بكل الحقول الناقصة', async () => {
    const { service } = setup()
    const body = await errorsOf(service.preview({} as never, NOW))
    expect(Object.keys(body.errors).sort()).toEqual(['serviceIds', 'startDate', 'startTime'])
  })

  it('مع seriesId: يدمج المرسَل فوق القالب الحالي ويمرّر المعرّف', async () => {
    const { service, engine } = setup()
    await service.preview({ seriesId: 'r1', startTime: '18:30' } as never, NOW)
    expect(engine.preview).toHaveBeenCalledWith(
      {
        startDate: '2026-10-17',
        startTime: '18:30',
        intervalWeeks: 2,
        endDate: null,
        serviceIds: ['s1', 's2'],
        stopped: false,
      },
      'r1',
      NOW,
    )
  })

  it('سلسلة موقوفة ← 409', async () => {
    const { service } = setup({ series: seriesRow({ stoppedAt: new Date() }) })
    await expect(service.preview({ seriesId: 'r1' } as never, NOW)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('يسمّي الخدمات ويُبلغ بأعداد الحذف والمعدّل', async () => {
    const { service, engine } = setup()
    engine.preview.mockResolvedValue({
      create: [
        {
          date: '2026-10-17',
          k: 0,
          serviceId: 's2',
          startAt: new Date('2026-10-17T14:00:00Z'),
          endAt: new Date('2026-10-17T14:45:00Z'),
        },
      ],
      remove: [{}, {}],
      issues: [{ date: '2026-10-31', k: 1, reason: 'CONFLICT' }],
      keptEdited: 1,
    })
    const result = await service.preview(create() as never, NOW)
    expect(result.occurrences[0].serviceName).toBe('لحية')
    expect(result).toMatchObject({ removeCount: 2, keptEdited: 1 })
    expect(result.issues).toHaveLength(1)
  })
})

describe('RecurringBookingsService.list / findOne', () => {
  it('الافتراضي: الفعّالة فقط (المنتهية بتاريخها لا تظهر)', async () => {
    const { service, prisma } = setup()
    prisma.recurringBooking.findMany.mockResolvedValue([
      seriesRow(),
      seriesRow({ id: 'r2', endDate: new Date('2026-10-01T00:00:00Z') }),
    ])
    const list = await service.list({}, NOW)
    expect(list.map((s) => s.id)).toEqual(['r1'])
    expect(prisma.recurringBooking.findMany.mock.calls[0][0].where).toEqual({ stoppedAt: null })
  })

  it('customerId: يصل إلى where (ملف الزبون)', async () => {
    const { service, prisma } = setup()
    await service.list({ customerId: 'c1' }, NOW)
    expect(prisma.recurringBooking.findMany.mock.calls[0][0].where).toEqual({
      stoppedAt: null,
      customerId: 'c1',
    })
  })

  it('includeStopped: الكل بحالاتها', async () => {
    const { service, prisma } = setup()
    prisma.recurringBooking.findMany.mockResolvedValue([
      seriesRow(),
      seriesRow({ id: 'r2', endDate: new Date('2026-10-01T00:00:00Z') }),
      seriesRow({ id: 'r3', stoppedAt: new Date('2026-10-05T00:00:00Z') }),
    ])
    const list = await service.list({ includeStopped: true }, NOW)
    expect(list.map((s) => [s.id, s.status])).toEqual([
      ['r1', 'ACTIVE'],
      ['r2', 'ENDED'],
      ['r3', 'STOPPED'],
    ])
    expect(prisma.recurringBooking.findMany.mock.calls[0][0].where).toEqual({})
  })

  it('العرض: يوم الأسبوع والخدمات المسمّاة بترتيبها والموعد التالي، بلا أي مال', async () => {
    const { service, prisma } = setup()
    prisma.booking.findMany.mockImplementation((args: { select?: unknown }) =>
      Promise.resolve(
        args.select
          ? [
              {
                recurringId: 'r1',
                startAt: new Date('2026-10-17T14:00:00Z'),
                serviceName: 'شعر',
                occurrenceDate: new Date('2026-10-17T00:00:00Z'),
              },
              {
                recurringId: 'r1',
                startAt: new Date('2026-10-31T14:00:00Z'),
                serviceName: 'لحية',
                occurrenceDate: new Date('2026-10-31T00:00:00Z'),
              },
            ]
          : [],
      ),
    )
    const [view] = await service.list({}, NOW)
    expect(view.weekday).toBe(6) // السبت
    expect(view.services.map((s) => s.name)).toEqual(['شعر', 'لحية'])
    expect(view.next).toEqual({
      date: '2026-10-17',
      startAt: new Date('2026-10-17T14:00:00Z'),
      serviceName: 'شعر',
    })
    expect(JSON.stringify(view)).not.toMatch(/price|paidAmount/)
  })

  it('findOne: غير موجود ← 404', async () => {
    const { service } = setup({ series: null })
    await expect(service.findOne('nope', STAFF, NOW)).rejects.toBeInstanceOf(NotFoundException)
  })
})
