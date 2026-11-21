import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import type { PrismaService } from '../../prisma/prisma.service'
import { MAX_DEVICES_PER_USER, PushService } from './push.service'
import type { PushSenderService } from './push-sender.service'

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc'
const DTO = { endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }

function setup(options: { enabled?: boolean; surplus?: Array<{ id: string }> } = {}) {
  const prisma = {
    pushSubscription: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue(options.surplus ?? []),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  }
  const sender = {
    enabled: options.enabled ?? true,
    publicKey: options.enabled === false ? undefined : 'PUBLIC',
    send: jest.fn().mockResolvedValue({ sent: 1, removed: 0, failed: 0 }),
  }
  const service = new PushService(
    prisma as unknown as PrismaService,
    sender as unknown as PushSenderService,
  )
  return { service, prisma, sender }
}

describe('PushService', () => {
  it('public-key: يرجع المفتاح العام، و503 بلا مفاتيح', () => {
    expect(setup().service.publicKey()).toEqual({ publicKey: 'PUBLIC' })
    expect(() => setup({ enabled: false }).service.publicKey()).toThrow(ServiceUnavailableException)
  })

  describe('subscribe', () => {
    it('يرفض عنواناً خارج قائمة المضيفين (SSRF) ولا يكتب', async () => {
      const { service, prisma } = setup()
      await expect(
        service.subscribe('u1', { ...DTO, endpoint: 'https://127.0.0.1/x' }, undefined),
      ).rejects.toThrow(BadRequestException)
      expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled()
    })

    it('upsert على endpoint: ينقل الملكية للمستخدم الحالي ويحدّث lastSeenAt', async () => {
      const { service, prisma } = setup()
      await service.subscribe('u2', DTO, 'Mozilla/5.0 (Linux; Android 14; POCO)')
      const [args] = prisma.pushSubscription.upsert.mock.calls[0] as [
        {
          where: unknown
          create: Record<string, unknown>
          update: Record<string, unknown>
        },
      ]
      expect(args.where).toEqual({ endpoint: ENDPOINT })
      expect(args.update).toMatchObject({ userId: 'u2', p256dh: 'p', auth: 'a' })
      expect(args.update.lastSeenAt).toBeInstanceOf(Date)
      expect(args.create).toMatchObject({ endpoint: ENDPOINT, userId: 'u2' })
    })

    it('يقصّ userAgent الطويل', async () => {
      const { service, prisma } = setup()
      await service.subscribe('u1', DTO, 'x'.repeat(500))
      const [args] = prisma.pushSubscription.upsert.mock.calls[0] as [
        { update: { userAgent: string } },
      ]
      expect(args.update.userAgent).toHaveLength(200)
    })

    it('تجاوز حد الأجهزة يحذف الأقدم استعمالاً فقط', async () => {
      const { service, prisma } = setup({ surplus: [{ id: 'old1' }, { id: 'old2' }] })
      await service.subscribe('u1', DTO, undefined)
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { lastSeenAt: 'desc' },
        skip: MAX_DEVICES_PER_USER,
        select: { id: true },
      })
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old1', 'old2'] } },
      })
    })

    it('بلا فائض لا يحذف شيئاً', async () => {
      const { service, prisma } = setup()
      await service.subscribe('u1', DTO, undefined)
      expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled()
    })
  })

  it('unsubscribe: يحذف جهاز المستخدم نفسه فقط (userId في الشرط)', async () => {
    const { service, prisma } = setup()
    await service.unsubscribe('u1', ENDPOINT)
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: ENDPOINT, userId: 'u1' },
    })
  })

  describe('test', () => {
    it('يرسل لأجهزة المستخدم الحالي فقط', async () => {
      const { service, prisma, sender } = setup()
      prisma.pushSubscription.findMany.mockResolvedValue([
        { endpoint: ENDPOINT, p256dh: 'p', auth: 'a' },
      ])
      expect(await service.test('u1')).toEqual({ devices: 1, sent: 1, removed: 0, failed: 0 })
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      )
      expect(sender.send).toHaveBeenCalledTimes(1)
    })

    it('بلا جهاز مشترك: 400', async () => {
      await expect(setup().service.test('u1')).rejects.toThrow(BadRequestException)
    })

    it('الخادم بلا مفاتيح: 503', async () => {
      await expect(setup({ enabled: false }).service.test('u1')).rejects.toThrow(
        ServiceUnavailableException,
      )
    })
  })
})
