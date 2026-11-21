import type { AppConfig } from '../../config/app-config'
import type { PrismaService } from '../../prisma/prisma.service'
import type { SettingsService } from '../settings/settings.service'
import { PushAlertService } from './push-alert.service'
import type { PushSenderService } from './push-sender.service'

const NOW = new Date('2026-11-21T12:00:00.000Z')
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  startAt: at(14),
  createdAt: at(-600),
  serviceName: 'قص شعر',
  customer: { name: 'أحمد العلي' },
  ...over,
})

const RECIPIENT = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: 'p', auth: 'a' }

function setup(options: { bookings?: unknown[]; recipients?: unknown[]; claim?: number } = {}) {
  const prisma = {
    booking: {
      findMany: jest.fn().mockResolvedValue(options.bookings ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: options.claim ?? 1 }),
    },
    pushSubscription: { findMany: jest.fn().mockResolvedValue(options.recipients ?? [RECIPIENT]) },
  }
  const sender = { send: jest.fn().mockResolvedValue({ sent: 1, removed: 0, failed: 0 }) }
  const settings = { get: jest.fn().mockResolvedValue({ timezone: 'Asia/Dubai' }) }
  const config = {
    pushAlertMinutes: 15,
    isTest: false,
    vapid: { publicKey: 'k', privateKey: 'p', subject: 'https://x.test' },
  }
  const service = new PushAlertService(
    config as unknown as AppConfig,
    prisma as unknown as PrismaService,
    settings as unknown as SettingsService,
    sender as unknown as PushSenderService,
  )
  return { service, prisma, sender }
}

describe('PushAlertService.run', () => {
  it('الاستعلام: ACTIVE بلا علامة وضمن (الآن+1د ، الآن+15د]', async () => {
    const { service, prisma } = setup()
    await service.run(NOW)
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          startAlertSentAt: null,
          startAt: { gt: at(1), lte: at(15) },
        },
      }),
    )
  })

  it('يرسل لكل مستحق بعد حجزه الذرّي، بحمولة «الاسم · الخدمة · الوقت» بلا مال', async () => {
    const { service, prisma, sender } = setup({ bookings: [booking()] })
    const result = await service.run(NOW)

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', startAlertSentAt: null, startAt: at(14) },
      data: { startAlertSentAt: NOW },
    })
    expect(sender.send).toHaveBeenCalledTimes(1)
    const [targets, payload, ttl] = sender.send.mock.calls[0] as [
      unknown[],
      Record<string, string>,
      number,
    ]
    expect(targets).toEqual([RECIPIENT])
    expect(payload.title).toBe('موعد بعد 14 دقيقة')
    expect(payload.body).toMatch(/^أحمد العلي · قص شعر · /)
    expect(Object.keys(payload).sort()).toEqual(['body', 'tag', 'title'])
    expect(ttl).toBe(14 * 60)
    expect(result).toMatchObject({ due: 1, claimed: 1, sent: 1 })
  })

  it('D2: حجز أُنشئ داخل نافذة الـ 15 دقيقة لا يُشعَر به ولا يُحجز', async () => {
    const { service, prisma, sender } = setup({
      bookings: [booking({ createdAt: at(0) })], // أُنشئ الآن وبدايته بعد 14 دقيقة (< 15)
    })
    const result = await service.run(NOW)
    expect(result?.due).toBe(0)
    expect(prisma.booking.updateMany).not.toHaveBeenCalled()
    expect(sender.send).not.toHaveBeenCalled()
  })

  it('خسر الحجز الذرّي (نسخة أخرى سبقت): لا إرسال', async () => {
    const { service, sender } = setup({ bookings: [booking()], claim: 0 })
    const result = await service.run(NOW)
    expect(sender.send).not.toHaveBeenCalled()
    expect(result).toMatchObject({ due: 1, claimed: 0 })
  })

  it('بلا مستلمين: لا يستهلك الإنذار (لا حجز) كي يصل من يشترك لاحقاً', async () => {
    const { service, prisma, sender } = setup({ bookings: [booking()], recipients: [] })
    await service.run(NOW)
    expect(prisma.booking.updateMany).not.toHaveBeenCalled()
    expect(sender.send).not.toHaveBeenCalled()
  })

  it('المستلمون: مستخدمون فعّالون بصلاحية notifications.receive وجهاز فُتح خلال 30 يوماً', async () => {
    const { service, prisma } = setup({ bookings: [booking()] })
    await service.run(NOW)
    const [{ where }] = prisma.pushSubscription.findMany.mock.calls[0] as [{ where: unknown }]
    expect(where).toEqual({
      lastSeenAt: { gte: new Date(NOW.getTime() - 30 * 86_400_000) },
      user: { isActive: true, role: { permissions: { some: { key: 'notifications.receive' } } } },
    })
  })

  it('عدّة حجوزات: إشعار لكل حجز بوسمه (tag)', async () => {
    const { service, sender } = setup({
      bookings: [booking({ id: 'b1' }), booking({ id: 'b2', startAt: at(9) })],
    })
    await service.run(NOW)
    const tags = sender.send.mock.calls.map((c) => (c[1] as { tag: string }).tag)
    expect(tags).toEqual(['booking-b1', 'booking-b2'])
  })

  it('خطأ في القاعدة لا يرمي (يُسجَّل فقط) ولا يعلّق الدورة التالية', async () => {
    const { service, prisma } = setup()
    prisma.booking.findMany.mockRejectedValueOnce(new Error('db down'))
    await expect(service.run(NOW)).resolves.toBeNull()
    prisma.booking.findMany.mockResolvedValueOnce([])
    await expect(service.run(NOW)).resolves.toMatchObject({ due: 0 })
  })
})

describe('PushAlertService — التفعيل', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  const make = (config: Partial<Record<string, unknown>>) =>
    new PushAlertService(
      {
        pushAlertMinutes: 15,
        isTest: false,
        vapid: { publicKey: 'k', privateKey: 'p', subject: 'https://x.test' },
        ...config,
      } as unknown as AppConfig,
      { booking: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService,
      {} as SettingsService,
      {} as PushSenderService,
    )

  it.each([
    ['في الاختبارات', { isTest: true }],
    ['بـ PUSH_ALERT_MINUTES=0', { pushAlertMinutes: 0 }],
    ['بلا مفاتيح VAPID', { vapid: undefined }],
  ])('تبقى معطّلة %s', (_label, config) => {
    const service = make(config)
    const spy = jest.spyOn(service, 'run')
    service.onApplicationBootstrap()
    jest.advanceTimersByTime(5 * 60_000)
    expect(spy).not.toHaveBeenCalled()
  })

  it('مفعّلة: أول فحص بعد 20ث ثم كل دقيقة', () => {
    const service = make({})
    const spy = jest.spyOn(service, 'run').mockResolvedValue(null)
    service.onApplicationBootstrap()
    jest.advanceTimersByTime(20_000)
    expect(spy).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(60_000)
    expect(spy).toHaveBeenCalledTimes(2)
    service.onModuleDestroy()
  })
})
