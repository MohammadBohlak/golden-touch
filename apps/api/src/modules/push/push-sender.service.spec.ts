import webpush from 'web-push'
import type { AppConfig } from '../../config/app-config'
import type { PrismaService } from '../../prisma/prisma.service'
import { PushSenderService } from './push-sender.service'

jest.mock('web-push', () => {
  class WebPushError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message)
    }
  }
  return {
    __esModule: true,
    default: { setVapidDetails: jest.fn(), sendNotification: jest.fn(), WebPushError },
  }
})

const send = webpush.sendNotification as jest.Mock
const fail = (status: number) => new webpush.WebPushError('err', status, {}, '', 'https://x')

const TARGET = { endpoint: 'https://fcm.googleapis.com/fcm/send/a', p256dh: 'p', auth: 'a' }
const PAYLOAD = { title: 't', body: 'b', tag: 'booking-1' }

function make(withKeys = true) {
  const prisma = { pushSubscription: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } }
  const vapid = withKeys
    ? { publicKey: 'pub', privateKey: 'priv', subject: 'https://x.test' }
    : undefined
  const service = new PushSenderService({ vapid } as AppConfig, prisma as unknown as PrismaService)
  service.onApplicationBootstrap()
  return { service, prisma }
}

describe('PushSenderService', () => {
  beforeEach(() => send.mockReset().mockResolvedValue({ statusCode: 201 }))

  it('بلا مفاتيح VAPID: معطّل ولا يرسل', async () => {
    const { service } = make(false)
    expect(service.enabled).toBe(false)
    expect(service.publicKey).toBeUndefined()
    await expect(service.send([TARGET], PAYLOAD, 600)).resolves.toEqual({
      sent: 0,
      removed: 0,
      failed: 0,
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('يرسل بـ TTL وUrgency high وحمولة JSON', async () => {
    const { service } = make()
    const summary = await service.send([TARGET], PAYLOAD, 600)
    expect(summary).toEqual({ sent: 1, removed: 0, failed: 0 })
    const [sub, body, options] = send.mock.calls[0] as [unknown, string, unknown]
    expect(sub).toEqual({ endpoint: TARGET.endpoint, keys: { p256dh: 'p', auth: 'a' } })
    expect(JSON.parse(body)).toEqual(PAYLOAD)
    expect(options).toEqual({ TTL: 600, urgency: 'high' })
  })

  it.each([404, 410])('%i يحذف الاشتراك ولا يعيد المحاولة', async (status) => {
    const { service, prisma } = make()
    send.mockRejectedValue(fail(status))
    const summary = await service.send([TARGET], PAYLOAD, 600)
    expect(summary).toEqual({ sent: 0, removed: 1, failed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: TARGET.endpoint },
    })
  })

  it.each([500, 503, 429, 0])('عطل مؤقت (%i): محاولة ثانية فورية تنجح', async (status) => {
    const { service } = make()
    send.mockRejectedValueOnce(status === 0 ? new Error('network') : fail(status))
    send.mockResolvedValueOnce({ statusCode: 201 })
    expect(await service.send([TARGET], PAYLOAD, 600)).toEqual({ sent: 1, removed: 0, failed: 0 })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('فشل مؤقت متكرر: محاولتان فقط ثم يُحصى فاشلاً ولا يرمي', async () => {
    const { service, prisma } = make()
    send.mockRejectedValue(fail(503))
    expect(await service.send([TARGET], PAYLOAD, 600)).toEqual({ sent: 0, removed: 0, failed: 1 })
    expect(send).toHaveBeenCalledTimes(2)
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })

  it('403 (خطأ مفاتيح): يُحصى فاشلاً ولا يُحذف شيء ولا تُعاد المحاولة', async () => {
    const { service, prisma } = make()
    send.mockRejectedValue(fail(403))
    expect(await service.send([TARGET], PAYLOAD, 600)).toEqual({ sent: 0, removed: 0, failed: 1 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })

  it('جهاز يفشل لا يمنع الآخر', async () => {
    const { service } = make()
    send.mockRejectedValueOnce(fail(410)).mockResolvedValueOnce({ statusCode: 201 })
    const other = { ...TARGET, endpoint: 'https://fcm.googleapis.com/fcm/send/b' }
    expect(await service.send([TARGET, other], PAYLOAD, 600)).toEqual({
      sent: 1,
      removed: 1,
      failed: 0,
    })
  })
})
