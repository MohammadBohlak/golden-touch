import type { AuthUser } from '../../common/types/auth-user'
import type { PrismaService } from '../../prisma/prisma.service'
import { ServicesService } from './services.service'

const user = (permissions: string[]): AuthUser => ({
  id: 'u1',
  name: 'مستخدم',
  email: 'u@x.test',
  phone: null,
  role: { id: 1, name: 'x', label: 'x' },
  permissions,
})
const STAFF = user(['services.read'])
const ADMIN = user(['services.read', 'finance.read'])

const row = {
  id: 's1',
  name: 'شعر',
  price: 25000,
  durationMinutes: 30,
  isActive: true,
  sortOrder: 1,
  archivedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
}

function setup() {
  const prisma = {
    service: {
      findMany: jest.fn().mockResolvedValue([row]),
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 1 } }),
    },
  }
  return { service: new ServicesService(prisma as unknown as PrismaService), prisma }
}

describe('ServicesService — السعر لمن يملك finance.read فقط', () => {
  it('المشرف: findAll و findOne بلا price', async () => {
    const { service } = setup()
    const list = await service.findAll(true, STAFF)
    expect(list[0]).not.toHaveProperty('price')
    expect(list[0]).toMatchObject({ name: 'شعر', durationMinutes: 30 })
    expect(await service.findOne('s1', STAFF)).not.toHaveProperty('price')
  })

  it('المدير: السعر موجود', async () => {
    const { service } = setup()
    expect((await service.findAll(true, ADMIN))[0].price).toBe(25000)
    expect((await service.findOne('s1', ADMIN)).price).toBe(25000)
  })

  it('create/update لا يعيدان السعر لمن لا يملك finance.read', async () => {
    const { service } = setup()
    expect(
      await service.create({ name: 'شعر', price: 25000, durationMinutes: 30 } as never, STAFF),
    ).not.toHaveProperty('price')
    expect(await service.update('s1', { price: 1 } as never, STAFF)).not.toHaveProperty('price')
  })
})

describe('ServicesService.remove', () => {
  const make = (bookings: number, recurring: number) => {
    const { service, prisma } = setup()
    const del = jest.fn().mockResolvedValue({})
    Object.assign(prisma.service, { delete: del })
    Object.assign(prisma, {
      booking: { count: jest.fn().mockResolvedValue(bookings) },
      recurringBookingService: { count: jest.fn().mockResolvedValue(recurring) },
    })
    return { service, update: prisma.service.update, del }
  }

  it('خدمة في تناوب حجز دوري بلا حجوزات ← تُؤرشف ولا تُحذف', async () => {
    const { service, update, del } = make(0, 2)
    await expect(service.remove('s1')).resolves.toEqual({ archived: true })
    expect(update).toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('خدمة بحجوزات ← تُؤرشف', async () => {
    const { service } = make(3, 0)
    await expect(service.remove('s1')).resolves.toEqual({ archived: true })
  })

  it('خدمة غير مستعملة ← تُحذف', async () => {
    const { service, del } = make(0, 0)
    await expect(service.remove('s1')).resolves.toEqual({ archived: false })
    expect(del).toHaveBeenCalled()
  })
})
