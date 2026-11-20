import { ConflictException, NotFoundException } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import type { AuthUser } from '../../common/types/auth-user'
import type { PrismaService } from '../../prisma/prisma.service'
import type { SettingsService } from '../settings/settings.service'
import { CustomersService } from './customers.service'

/** "الآن" = 2026-10-16 15:00 دمشق → بداية اليوم (cutoff) = 2026-10-15T21:00Z */
const NOW = new Date('2026-10-16T12:00:00Z')
const CUTOFF = new Date('2026-10-15T21:00:00Z')

const user = (permissions: string[]): AuthUser => ({
  id: 'u1',
  name: 'مستخدم',
  email: 'u@x.test',
  phone: null,
  role: { id: 1, name: 'x', label: 'x' },
  permissions,
})
const STAFF = user(['customers.read'])
const ADMIN = user(['customers.read', 'finance.read', 'bookings.history'])
const FINANCE_ONLY = user(['customers.read', 'finance.read'])

const customer = {
  id: 'c1',
  name: 'زبون',
  phone: '0991234567',
  notes: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
}
const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  customerId: 'c1',
  serviceId: 's1',
  serviceName: 'شعر',
  price: 25000,
  paidAmount: null,
  startAt: new Date('2026-10-17T10:00:00Z'),
  endAt: new Date('2026-10-17T10:30:00Z'),
  status: BookingStatus.ACTIVE,
  customer: { id: 'c1', name: 'زبون', phone: null },
  createdBy: null,
  ...over,
})

function setup() {
  const prisma = {
    customer: {
      findUnique: jest.fn().mockResolvedValue(customer),
      findMany: jest.fn().mockResolvedValue([{ ...customer, _count: { bookings: 4 } }]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
      update: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
    booking: {
      aggregate: jest.fn().mockResolvedValue({
        _count: 4,
        _sum: { paidAmount: 100000 },
        _max: { startAt: new Date('2026-10-01T10:00:00Z') },
      }),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([booking()]),
      groupBy: jest
        .fn()
        .mockResolvedValue([
          { customerId: 'c1', _max: { startAt: new Date('2026-10-01T10:00:00Z') } },
        ]),
    },
    $transaction: jest.fn((arg: unknown[]) => Promise.all(arg)),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
  }
  const settings = { get: jest.fn().mockResolvedValue({ timezone: 'Asia/Damascus' }) }
  const service = new CustomersService(
    prisma as unknown as PrismaService,
    settings as unknown as SettingsService,
  )
  return { service, prisma }
}

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(NOW)
})
afterAll(() => {
  jest.useRealTimers()
})

describe('CustomersService.findAll', () => {
  it('المشرف: بلا visits/lastVisitAt ودون استعلام المكتملة', async () => {
    const { service, prisma } = setup()
    const result = await service.findAll({ page: 1, limit: 10, skip: 0 } as never, STAFF)
    expect(result.items[0]).toEqual({
      id: 'c1',
      name: 'زبون',
      phone: '0991234567',
      notes: null,
      createdAt: customer.createdAt,
    })
    expect(result.items[0]).not.toHaveProperty('visits')
    expect(result.items[0]).not.toHaveProperty('lastVisitAt')
    expect(prisma.booking.groupBy).not.toHaveBeenCalled()
  })

  it('المدير: الزيارات وآخر زيارة', async () => {
    const { service } = setup()
    const result = await service.findAll({ page: 1, limit: 10, skip: 0 } as never, ADMIN)
    expect(result.items[0]).toMatchObject({
      visits: 4,
      lastVisitAt: new Date('2026-10-01T10:00:00Z'),
    })
  })
})

describe('CustomersService.findOne', () => {
  it('المشرف: حجوزات من بداية اليوم فقط، إحصائية القادمة وحدها، بلا مال', async () => {
    const { service, prisma } = setup()
    const result = await service.findOne('c1', STAFF)

    const [{ where, orderBy }] = prisma.booking.findMany.mock.calls[0] as [
      { where: { customerId: string; startAt: { gte: Date } }; orderBy: { startAt: string } },
    ]
    expect(where.customerId).toBe('c1')
    expect(where.startAt.gte).toEqual(CUTOFF)
    expect(orderBy.startAt).toBe('asc')

    expect(result.stats).toEqual({ upcoming: 1 })
    expect(prisma.booking.aggregate).not.toHaveBeenCalled()
    expect(result.bookings).toHaveLength(1)
    expect(result.bookings[0]).not.toHaveProperty('price')
    expect(JSON.stringify(result)).not.toMatch(/25000|100000|totalSpent/)
  })

  it('المدير: السجل كاملاً (الأحدث أولاً) مع كل الإحصائيات', async () => {
    const { service, prisma } = setup()
    const result = await service.findOne('c1', ADMIN)
    const [{ where, orderBy }] = prisma.booking.findMany.mock.calls[0] as [
      { where: Record<string, unknown>; orderBy: { startAt: string } },
    ]
    expect(where).toEqual({ customerId: 'c1' })
    expect(orderBy.startAt).toBe('desc')
    expect(result.stats).toMatchObject({ visits: 4, cancelled: 1, totalSpent: 100000, upcoming: 1 })
    expect(result.bookings[0].price).toBe(25000)
  })

  it('المال بلا سجل: مجموع المدفوع نعم، الزيارات والماضي لا', async () => {
    const { service, prisma } = setup()
    const result = await service.findOne('c1', FINANCE_ONLY)
    expect(result.stats).toEqual({ upcoming: 1, totalSpent: 100000 })
    const [{ where }] = prisma.booking.findMany.mock.calls[0] as [
      { where: { startAt: { gte: Date } } },
    ]
    expect(where.startAt.gte).toEqual(CUTOFF)
  })

  it('زبون غير موجود → 404', async () => {
    const { service, prisma } = setup()
    prisma.customer.findUnique.mockResolvedValue(null)
    await expect(service.findOne('x', STAFF)).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('CustomersService.remove', () => {
  const make = (bookings: number, recurring: number) => {
    const { service, prisma } = setup()
    const del = jest.fn().mockResolvedValue({})
    Object.assign(prisma.customer, { delete: del })
    prisma.booking.count.mockResolvedValue(bookings)
    Object.assign(prisma, { recurringBooking: { count: jest.fn().mockResolvedValue(recurring) } })
    return { service, del }
  }

  it('لزبون حجز دوري (ولو موقوف) ← 409 بدل خطأ المفتاح الأجنبي', async () => {
    const { service, del } = make(0, 1)
    await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException)
    await expect(service.remove('c1')).rejects.toThrow('حجز دوري')
    expect(del).not.toHaveBeenCalled()
  })

  it('بلا حجوزات ولا سلاسل ← يُحذف', async () => {
    const { service, del } = make(0, 0)
    await expect(service.remove('c1')).resolves.toEqual({ success: true })
    expect(del).toHaveBeenCalled()
  })
})

describe('CustomersService.findAll — البحث', () => {
  const whereOf = (prisma: ReturnType<typeof setup>['prisma']) =>
    (prisma.customer.findMany.mock.calls[0] as [{ where: unknown }])[0].where

  it('الاسم بتوحيد الحروف العربية: المعرّفات المطابقة تدخل في where', async () => {
    const { service, prisma } = setup()
    await service.findAll({ skip: 0, limit: 8, page: 1, search: 'احمد' } as never, ADMIN)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(whereOf(prisma)).toEqual({ OR: [{ id: { in: ['c1', 'c2'] } }] })
  })

  it('رقم هاتف: يضاف شرط الهاتف إلى شرط الأسماء', async () => {
    const { service, prisma } = setup()
    await service.findAll({ skip: 0, limit: 8, page: 1, search: '٠٩٩١٢٣' } as never, ADMIN)
    expect(whereOf(prisma)).toEqual({
      OR: [
        { id: { in: ['c1', 'c2'] } },
        { phone: { contains: '099123' } },
        { phone: { startsWith: '963' + '99123' } },
        { phone: { startsWith: '+963' + '99123' } },
        { phone: { startsWith: '00963' + '99123' } },
      ],
    })
  })

  it('بلا بحث: لا استعلام توحيد ولا شرط', async () => {
    const { service, prisma } = setup()
    await service.findAll({ skip: 0, limit: 8, page: 1 } as never, ADMIN)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(whereOf(prisma)).toEqual({})
  })
})

describe('CustomersService — تكرار الهاتف', () => {
  const owners = [{ id: 'c9', name: 'أبو أحمد' }]
  const phoneWhere = (prisma: ReturnType<typeof setup>['prisma']) =>
    (prisma.customer.findMany.mock.calls[0] as [{ where: { phone: { in: string[] }; id?: unknown } }])[0]
      .where

  it('إضافة بهاتف مسجّل (بأي صيغة) ← 409 PHONE_DUPLICATE بأسماء الزبائن ولا يُنشأ', async () => {
    const { service, prisma } = setup()
    prisma.customer.findMany.mockResolvedValue(owners)
    const error = await service.create({ name: 'س', phone: '+963 991 234 567' }).catch((e) => e)
    expect(error).toBeInstanceOf(ConflictException)
    expect(error.getResponse()).toMatchObject({
      code: 'PHONE_DUPLICATE',
      data: { customers: owners },
    })
    expect(error.getResponse().message).toContain('أبو أحمد')
    expect(phoneWhere(prisma).phone.in).toEqual(
      expect.arrayContaining(['+963991234567', '0991234567', '963991234567']),
    )
    expect(prisma.customer.create).not.toHaveBeenCalled()
  })

  it('إضافة بهاتف مكرر مع confirmDuplicatePhone ← تُنشأ دون فحص', async () => {
    const { service, prisma } = setup()
    prisma.customer.findMany.mockResolvedValue(owners)
    await service.create({ name: 'س', phone: '0991234567', confirmDuplicatePhone: true })
    expect(prisma.customer.findMany).not.toHaveBeenCalled()
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: { name: 'س', phone: '0991234567', notes: null },
    })
  })

  it('إضافة بلا هاتف ← لا فحص', async () => {
    const { service, prisma } = setup()
    await service.create({ name: 'س' })
    expect(prisma.customer.findMany).not.toHaveBeenCalled()
    expect(prisma.customer.create).toHaveBeenCalled()
  })

  it('تعديل بهاتف جديد مسجّل لغيره ← 409، ويستثني الزبون نفسه من الفحص', async () => {
    const { service, prisma } = setup()
    prisma.customer.findMany.mockResolvedValue(owners)
    await expect(service.update('c1', { phone: '0955555555' })).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(phoneWhere(prisma).id).toEqual({ not: 'c1' })
    expect(prisma.customer.update).not.toHaveBeenCalled()
  })

  it('تعديل دون تغيير الهاتف (يشاركه مع غيره أصلاً) ← لا تنبيه', async () => {
    const { service, prisma } = setup()
    prisma.customer.findMany.mockResolvedValue(owners)
    await service.update('c1', { name: 'جديد', phone: '0991234567' })
    expect(prisma.customer.findMany).not.toHaveBeenCalled()
    expect(prisma.customer.update).toHaveBeenCalled()
  })

  it('تعديل زبون غير موجود ← 404', async () => {
    const { service, prisma } = setup()
    prisma.customer.findUnique.mockResolvedValue(null)
    await expect(service.update('x', { name: 'س' })).rejects.toBeInstanceOf(NotFoundException)
  })
})
