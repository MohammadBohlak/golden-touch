import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import webpush from 'web-push'
import type { AppConfig } from '../../config/app-config'
import { MAX_PENDING, PushLabService } from './push-lab.service'

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
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc'
const KEYS = { p256dh: 'p', auth: 'a' }

function make(withKeys = true) {
  const vapid = withKeys
    ? { publicKey: 'pub', privateKey: 'priv', subject: 'https://x.test' }
    : undefined
  const service = new PushLabService({ vapid } as AppConfig)
  service.onApplicationBootstrap()
  return service
}

describe('PushLabService', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    send.mockReset().mockResolvedValue({ statusCode: 201 })
  })
  afterEach(() => jest.useRealTimers())

  it('بلا مفاتيح VAPID: معطّلة وترفض بـ 503', () => {
    const service = make(false)
    expect(service.enabled).toBe(false)
    expect(() => service.subscribe('u1', ENDPOINT, KEYS)).toThrow(ServiceUnavailableException)
  })

  it('يرفض عنوان اشتراك خارج قائمة المضيفين', () => {
    expect(() => make().subscribe('u1', 'https://evil.example/x', KEYS)).toThrow(
      BadRequestException,
    )
  })

  it('يرفض الإرسال بلا جهاز مشترك', async () => {
    await expect(make().send('u1', 0)).rejects.toThrow(BadRequestException)
  })

  it('يرسل فوراً بـ Urgency high ويسجّل الحالة بلا عنوان الاشتراك', async () => {
    const service = make()
    service.subscribe('u1', ENDPOINT, KEYS)
    await service.send('u1', 0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][2]).toMatchObject({ urgency: 'high' })
    const { log } = service.status('u1')
    expect(log[0]).toMatchObject({ status: 201, removed: false })
    expect(JSON.stringify(log)).not.toContain('fcm.googleapis.com')
  })

  it('المؤجَّل يظهر معلّقاً ثم يُرسل في موعده', async () => {
    const service = make()
    service.subscribe('u1', ENDPOINT, KEYS)
    await service.send('u1', 60)
    expect(service.status('u1').pending).toEqual([{ inSeconds: 60 }])
    expect(send).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(60_000)
    expect(send).toHaveBeenCalledTimes(1)
    expect(service.status('u1').pending).toEqual([])
  })

  it('لا يتجاوز الحد الأقصى للمجدول', async () => {
    const service = make()
    service.subscribe('u1', ENDPOINT, KEYS)
    for (let i = 0; i < MAX_PENDING; i++) await service.send('u1', 60)
    await expect(service.send('u1', 60)).rejects.toThrow(BadRequestException)
    service.onModuleDestroy()
  })

  it('410 يحذف الاشتراك', async () => {
    const service = make()
    service.subscribe('u1', ENDPOINT, KEYS)
    send.mockRejectedValue(new webpush.WebPushError('gone', 410, {}, '', ENDPOINT))
    await service.send('u1', 0)
    expect(service.status('u1')).toMatchObject({ subscriptions: 0 })
    expect(service.status('u1').log[0]).toMatchObject({ status: 410, removed: true })
  })

  it('الاشتراك يخصّ مستخدمه: غيره لا يرسل إلى جهازه ولا يحذفه', async () => {
    const service = make()
    service.subscribe('u1', ENDPOINT, KEYS)
    service.unsubscribe('u2', ENDPOINT)
    expect(service.status('u1').subscriptions).toBe(1)
    await expect(service.send('u2', 0)).rejects.toThrow(BadRequestException)
  })
})
