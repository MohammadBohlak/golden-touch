import type { Service } from '@prisma/client'
import { toServiceView } from './service.visibility'

const service: Service = {
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

describe('toServiceView', () => {
  it('من يملك finance.read يرى السعر', () => {
    expect(toServiceView(service, true).price).toBe(25000)
  })

  it('غيره يرى الاسم والمدة بلا مفتاح السعر', () => {
    const view = toServiceView(service, false)
    expect(view).not.toHaveProperty('price')
    expect(view).toMatchObject({ id: 's1', name: 'شعر', durationMinutes: 30, isActive: true })
    expect(JSON.stringify(view)).not.toContain('25000')
  })

  it('لا يعدّل الكائن الأصلي', () => {
    toServiceView(service, false)
    expect(service.price).toBe(25000)
  })
})
