import { ConflictException, NotFoundException } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import type { AppConfig } from '../../config/app-config'
import type { PrismaService } from '../../prisma/prisma.service'
import type { SettingsService } from '../settings/settings.service'
import { RecurringService } from './recurring.service'
import { toTemplate } from './recurring.mapper'

/**
 * Prisma وهمي: نفحص الاستعلامات والكتابات الفعلية لا القيم المُرجَعة فقط.
 * "الآن" = 2026-10-16 15:00 بتوقيت دمشق (جمعة) → اليوم 2026-10-16، الأفق 56 يوماً → 2026-12-11.
 * السبوت من 2026-10-17 حتى 2026-12-05 = 8 مواعيد أسبوعية، الساعة 17:00 محلياً = 14:00Z.
 */
const NOW = new Date('2026-10-16T12:00:00Z')
const SATURDAYS = [
  '2026-10-17',
  '2026-10-24',
  '2026-10-31',
  '2026-11-07',
  '2026-11-14',
  '2026-11-21',
  '2026-11-28',
  '2026-12-05',
]

const settings = {
  openTime: '10:00',
  closeTime: '22:00',
  slotMinutes: 15,
  timezone: 'Asia/Damascus',
  daysOff: [] as number[],
}

const svc = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  name: 'شعر',
  price: 25000,
  durationMinutes: 30,
  isActive: true,
  archivedAt: null,
  ...over,
})

const series = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  customerId: 'c1',
  startTime: '17:00',
  startDate: new Date('2026-10-17T00:00:00Z'),
  intervalWeeks: 1,
  endDate: null,
  notes: 'قصة قصيرة',
  stoppedAt: null,
  createdById: 'u1',
  services: [{ recurringId: 'r1', position: 0, serviceId: 's1' }],
  ...over,
})

const booking = (date: string, over: Record<string, unknown> = {}) => ({
  id: `b-${date}`,
  recurringId: 'r1',
  occurrenceDate: new Date(`${date}T00:00:00Z`),
  startAt: new Date(`${date}T14:00:00Z`),
  endAt: new Date(`${date}T14:30:00Z`),
  status: BookingStatus.ACTIVE,
  recurringEdited: false,
  ...over,
})

function setup(
  opts: { existing?: unknown[]; busy?: unknown[]; services?: unknown[]; series?: unknown } = {},
) {
  const base = {
    recurringBooking: {
      findUnique: jest.fn().mockResolvedValue(opts.series ?? series()),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    recurringBookingService: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    booking: {
      // استعلامان: المواعيد الموجودة للسلسلة (select.occurrenceDate) والمشغول (select.id)
      findMany: jest.fn((args: { select: Record<string, boolean> }) =>
        Promise.resolve(
          args.select.recurringEdited || args.select.occurrenceDate
            ? (opts.existing ?? [])
            : (opts.busy ?? []),
        ),
      ),
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn((args: { where: { id: { in: string[] } } }) =>
        Promise.resolve({ count: args.where.id.in.length }),
      ),
    },
    service: { findMany: jest.fn().mockResolvedValue(opts.services ?? [svc()]) },
  }
  const prisma = {
    ...base,
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(base)),
  }
  const service = new RecurringService(
    prisma as unknown as PrismaService,
    { get: jest.fn().mockResolvedValue(settings) } as unknown as SettingsService,
    { recurringHorizonDays: 56 } as AppConfig,
  )
  return { service, prisma: base, tx: prisma }
}

type Call = { data: Record<string, unknown>[]; skipDuplicates: boolean }
const createdRows = (p: ReturnType<typeof setup>['prisma']) =>
  (p.booking.createMany.mock.calls[0] as [Call])[0]
const dateOf = (row: Record<string, unknown>) =>
  (row.occurrenceDate as Date).toISOString().slice(0, 10)

describe('RecurringService.generate', () => {
  it('سلسلة جديدة: ينشئ كل مواعيد الأفق بلقطة الخدمة والسعر وسلسلتها', async () => {
    const { service, prisma } = setup()
    const result = await service.generate('r1', NOW)

    expect(result).toEqual({ created: 8, issues: [] })
    const { data, skipDuplicates } = createdRows(prisma)
    expect(skipDuplicates).toBe(true)
    expect(data.map(dateOf)).toEqual(SATURDAYS)
    expect(data[0]).toEqual({
      customerId: 'c1',
      serviceId: 's1',
      serviceName: 'شعر',
      price: 25000,
      durationMinutes: 30,
      startAt: new Date('2026-10-17T14:00:00Z'),
      endAt: new Date('2026-10-17T14:30:00Z'),
      notes: 'قصة قصيرة',
      createdById: 'u1',
      recurringId: 'r1',
      occurrenceDate: new Date('2026-10-17T00:00:00Z'),
    })
  })

  it('يملأ الفراغات فقط: الموعد الموجود (أي حالة) لا يُعاد', async () => {
    const { service, prisma } = setup({
      existing: [booking('2026-10-24', { status: BookingStatus.CANCELLED })],
    })
    const result = await service.generate('r1', NOW)
    expect(result.created).toBe(7)
    expect(createdRows(prisma).data.map(dateOf)).not.toContain('2026-10-24')
  })

  it('idempotent: كل المواعيد موجودة ← لا كتابة', async () => {
    const { service, prisma } = setup({ existing: SATURDAYS.map((d) => booking(d)) })
    expect(await service.generate('r1', NOW)).toEqual({ created: 0, issues: [] })
    expect(prisma.booking.createMany).not.toHaveBeenCalled()
  })

  it('استعلام المشغول: الحالات الحاجزة فقط ضمن نطاق الأفق (من أمس للدوام بعد منتصف الليل)', async () => {
    const { service, prisma } = setup()
    await service.generate('r1', NOW)
    const busyCall = prisma.booking.findMany.mock.calls
      .map(
        (c) =>
          c[0] as {
            where: { status: unknown; startAt: { lt: Date }; endAt: { gt: Date } }
            select: Record<string, boolean>
          },
      )
      .find((c) => c.select.id && c.select.startAt && !c.select.recurringEdited)!
    expect(busyCall.where.status).toEqual({ in: ['ACTIVE', 'COMPLETED'] })
    expect(busyCall.where.endAt.gt).toEqual(new Date('2026-10-14T21:00:00Z')) // بداية 2026-10-15 بتوقيت دمشق
    expect(busyCall.where.startAt.lt).toEqual(new Date('2026-12-12T21:00:00Z')) // نهاية 2026-12-12: يوم زائد بعد آخر موعد لدوام يتخطّى منتصف الليل
  })

  it('تعارض مع حجز قائم: لا يُنشأ ولا يُزاح، ويُبلَّغ كمشكلة', async () => {
    const { service, prisma } = setup({
      busy: [
        {
          id: 'x',
          startAt: new Date('2026-10-24T14:15:00Z'),
          endAt: new Date('2026-10-24T15:00:00Z'),
        },
      ],
    })
    const result = await service.generate('r1', NOW)
    expect(result.created).toBe(7)
    expect(result.issues).toEqual([{ date: '2026-10-24', k: 1, reason: 'CONFLICT' }])
    expect(createdRows(prisma).data.map(dateOf)).not.toContain('2026-10-24')
  })

  it('تناوب خدمتين: لقطة اسم وسعر ومدة كل موعد من خدمته', async () => {
    const { service, prisma } = setup({
      series: series({
        services: [
          { recurringId: 'r1', position: 1, serviceId: 's2' }, // ترتيب غير مرتب عمداً
          { recurringId: 'r1', position: 0, serviceId: 's1' },
        ],
      }),
      services: [svc(), svc({ id: 's2', name: 'لحية', price: 15000, durationMinutes: 45 })],
    })
    await service.generate('r1', NOW)
    const rows = createdRows(prisma).data
    expect(rows.slice(0, 3).map((r) => [r.serviceName, r.price, r.durationMinutes])).toEqual([
      ['شعر', 25000, 30],
      ['لحية', 15000, 45],
      ['شعر', 25000, 30],
    ])
  })

  it('خدمة مؤرشفة ← SERVICE_UNAVAILABLE ولا حجز', async () => {
    const { service, prisma } = setup({ services: [svc({ archivedAt: new Date() })] })
    const result = await service.generate('r1', NOW)
    expect(result.created).toBe(0)
    expect(result.issues).toHaveLength(8)
    expect(result.issues.every((i) => i.reason === 'SERVICE_UNAVAILABLE')).toBe(true)
    expect(prisma.booking.createMany).not.toHaveBeenCalled()
  })

  it('سلسلة موقوفة: لا استعلام عن الحجوزات ولا كتابة', async () => {
    const { service, prisma } = setup({ series: series({ stoppedAt: new Date('2026-10-01') }) })
    expect(await service.generate('r1', NOW)).toEqual({ created: 0, issues: [] })
    expect(prisma.booking.findMany).not.toHaveBeenCalled()
    expect(prisma.booking.createMany).not.toHaveBeenCalled()
  })

  it('سلسلة غير موجودة ← 404', async () => {
    const { service, prisma } = setup()
    prisma.recurringBooking.findUnique.mockResolvedValue(null)
    await expect(service.generate('nope', NOW)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('رفض القاعدة للدفعة بسبب تداخل متزامن ← إدراج صفاً صفاً وتخطّي المتعارض فقط', async () => {
    const { service, prisma } = setup()
    prisma.booking.createMany.mockRejectedValue(
      new Error('conflicting key value violates exclusion constraint "bookings_no_overlap"'),
    )
    let n = 0
    prisma.booking.create.mockImplementation(() => {
      n++
      return n === 2 ? Promise.reject(new Error('bookings_no_overlap')) : Promise.resolve({})
    })
    const result = await service.generate('r1', NOW)
    expect(prisma.booking.create).toHaveBeenCalledTimes(8)
    expect(result.created).toBe(7)
  })

  it('خطأ غير التداخل يُرمى ولا يُبتلع', async () => {
    const { service, prisma } = setup()
    prisma.booking.createMany.mockRejectedValue(new Error('connection lost'))
    await expect(service.generate('r1', NOW)).rejects.toThrow('connection lost')
    expect(prisma.booking.create).not.toHaveBeenCalled()
  })
})

describe('RecurringService.syncAll', () => {
  it('يمرّ على الفعّالة فقط ويجمع الأعداد، وفشل سلسلة لا يوقف البقية', async () => {
    const { service, prisma } = setup()
    prisma.recurringBooking.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'bad' }, { id: 'r3' }])
    prisma.recurringBooking.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === 'bad'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(series({ id: where.id })),
    )
    const result = await service.syncAll(NOW)

    const where = (
      prisma.recurringBooking.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where
    expect(where).toEqual({
      stoppedAt: null,
      OR: [{ endDate: null }, { endDate: { gte: new Date('2026-10-16T00:00:00Z') } }],
    })
    expect(result).toEqual({ series: 3, created: 16, issues: 0, failed: 1 })
  })
})

describe('RecurringService.preview', () => {
  it('بلا كتابة: سلسلة جديدة تُعرض مواعيدها كلها', async () => {
    const { service, prisma } = setup()
    const template = toTemplate(series() as never)
    const change = await service.preview(template, undefined, NOW)

    expect(change.create.map((o) => o.date)).toEqual(SATURDAYS)
    expect(change.remove).toEqual([])
    expect(prisma.booking.createMany).not.toHaveBeenCalled()
    expect(prisma.booking.deleteMany).not.toHaveBeenCalled()
    expect(prisma.recurringBooking.update).not.toHaveBeenCalled()
  })
})

describe('RecurringService.replaceFuture', () => {
  // e1 قابل لإعادة الكتابة، e2 معدّل يدوياً، e3 مُلغى
  const existing = [
    booking('2026-10-17'),
    booking('2026-10-24', { recurringEdited: true }),
    booking('2026-10-31', { status: BookingStatus.CANCELLED }),
  ]

  it('يحذف القابل فقط (بشروط وقائية) ولا يعيد المعدّل ولا المُلغى', async () => {
    const { service, prisma } = setup({ existing })
    const result = await service.replaceFuture('r1', { startTime: '18:00' }, NOW)

    expect(prisma.recurringBooking.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ startTime: '18:00' }),
    })
    expect(prisma.recurringBookingService.deleteMany).not.toHaveBeenCalled()
    expect(prisma.booking.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['b-2026-10-17'] },
        recurringId: 'r1',
        status: 'ACTIVE',
        recurringEdited: false,
        startAt: { gt: NOW },
      },
    })
    expect(prisma.booking.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    )
    const dates = createdRows(prisma).data.map(dateOf)
    expect(dates).toEqual([...SATURDAYS.filter((d) => !['2026-10-24', '2026-10-31'].includes(d))])
    expect(createdRows(prisma).data[0].startAt).toEqual(new Date('2026-10-17T15:00:00Z')) // 18:00 محلياً
    expect(result).toEqual({ removed: 1, created: 6, issues: [], keptEdited: 1 })
  })

  it('تغيير الخدمات: يستبدل صفوف التناوب بمواضعها ويولّد بالقائمة الجديدة', async () => {
    const { service, prisma } = setup({
      existing,
      services: [svc(), svc({ id: 's2', name: 'لحية', price: 15000, durationMinutes: 45 })],
    })
    await service.replaceFuture('r1', { serviceIds: ['s1', 's2'] }, NOW)
    expect(prisma.recurringBookingService.deleteMany).toHaveBeenCalledWith({
      where: { recurringId: 'r1' },
    })
    expect(prisma.recurringBookingService.createMany).toHaveBeenCalledWith({
      data: [
        { recurringId: 'r1', position: 0, serviceId: 's1' },
        { recurringId: 'r1', position: 1, serviceId: 's2' },
      ],
    })
    const rows = createdRows(prisma).data
    expect(rows.find((r) => dateOf(r) === '2026-10-17')?.serviceName).toBe('شعر') // k = 0
    expect(rows.find((r) => dateOf(r) === '2026-11-07')?.serviceName).toBe('لحية') // k = 3
  })

  it('endDate مبكر: المواعيد بعده القابلة تُحذف ولا تُعاد', async () => {
    const { service, prisma } = setup({ existing: [booking('2026-11-07'), booking('2026-11-14')] })
    const result = await service.replaceFuture('r1', { endDate: '2026-10-31' }, NOW)
    expect(result.removed).toBe(2)
    expect(createdRows(prisma).data.map(dateOf)).toEqual(['2026-10-17', '2026-10-24', '2026-10-31'])
    expect(prisma.recurringBooking.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ endDate: new Date('2026-10-31T00:00:00Z') }),
    })
  })

  it('سباق تداخل داخل المعاملة ← 409 برسالة عربية (وتُلغى المعاملة كلها)', async () => {
    const { service, prisma } = setup({ existing })
    prisma.booking.createMany.mockRejectedValue(new Error('bookings_no_overlap'))
    await expect(service.replaceFuture('r1', { startTime: '18:00' }, NOW)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })
})

describe('RecurringService.stop', () => {
  it('يضع stoppedAt ويحذف القابل فقط ولا يولّد شيئاً', async () => {
    const { service, prisma } = setup({
      existing: [booking('2026-10-17'), booking('2026-10-24', { recurringEdited: true })],
    })
    const result = await service.stop('r1', NOW)

    expect(prisma.recurringBooking.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { stoppedAt: NOW },
    })
    expect(prisma.booking.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['b-2026-10-17'] } }) }),
    )
    expect(prisma.booking.createMany).not.toHaveBeenCalled()
    expect(result).toEqual({ removed: 1, keptEdited: 1 })
  })

  it('موقوفة أصلاً: لا كتابة (idempotent)', async () => {
    const { service, prisma } = setup({ series: series({ stoppedAt: new Date('2026-10-01') }) })
    expect(await service.stop('r1', NOW)).toEqual({ removed: 0, keptEdited: 0 })
    expect(prisma.recurringBooking.update).not.toHaveBeenCalled()
    expect(prisma.booking.deleteMany).not.toHaveBeenCalled()
  })
})
