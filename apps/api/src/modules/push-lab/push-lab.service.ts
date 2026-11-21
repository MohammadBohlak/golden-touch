import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common'
import webpush from 'web-push'
import { AppConfig } from '../../config/app-config'
import { isAllowedPushEndpoint } from './push-endpoint'

/** الحد الأقصى لإرسالات مجدولة معلّقة لكل مستخدم */
export const MAX_PENDING = 5
const LOG_SIZE = 20
/** بتوقيت الصالون (المرحلة 0 بلا قاعدة بيانات فلا نقرأ ShopSettings) */
const TIME_ZONE = 'Asia/Damascus'

interface LabSubscription {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface LabLogEntry {
  at: string
  /** رمز استجابة خدمة Push (201 = قُبل)، أو 0 لفشل الشبكة */
  status: number
  removed: boolean
}

export interface LabPending {
  /** بعد كم ثانية سيُرسل */
  inSeconds: number
}

const clock = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * المرحلة 0 من docs/PUSH_NOTIFICATIONS_PLAN.md — **تجريبي ومؤقت**: يثبت وصول Web Push وصوته
 * على هاتف المدير الفعلي قبل بناء الميزة. الاشتراكات في الذاكرة فقط (تضيع بإعادة التشغيل)،
 * فلا migration ولا لمس لبيانات الإنتاج. يُحذف هذا المجلد عند بدء المرحلة 1.
 * السجل أعداد ورموز حالة فقط — بلا عناوين اشتراك ولا أسماء.
 */
@Injectable()
export class PushLabService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PushLabService.name)
  private readonly subscriptions = new Map<string, LabSubscription>()
  private readonly pending = new Map<NodeJS.Timeout, { userId: string; dueAt: number }>()
  private readonly log: LabLogEntry[] = []
  private ready = false

  constructor(private readonly config: AppConfig) {}

  onApplicationBootstrap(): void {
    const vapid = this.config.vapid
    if (!vapid) {
      this.logger.log('Push lab disabled: VAPID keys not set')
      return
    }
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
    this.ready = true
    this.logger.log('Push lab enabled')
  }

  onModuleDestroy(): void {
    for (const timer of this.pending.keys()) clearTimeout(timer)
    this.pending.clear()
  }

  get enabled(): boolean {
    return this.ready
  }

  get publicKey(): string | undefined {
    return this.ready ? this.config.vapid?.publicKey : undefined
  }

  status(userId: string) {
    const now = Date.now()
    return {
      enabled: this.ready,
      publicKey: this.publicKey ?? null,
      subscriptions: this.subscriptionsOf(userId).length,
      pending: [...this.pending.values()]
        .filter((p) => p.userId === userId)
        .map((p): LabPending => ({ inSeconds: Math.max(0, Math.round((p.dueAt - now) / 1000)) }))
        .sort((a, b) => a.inSeconds - b.inSeconds),
      log: this.log,
    }
  }

  subscribe(userId: string, endpoint: string, keys: { p256dh: string; auth: string }): void {
    this.assertReady()
    if (!isAllowedPushEndpoint(endpoint)) {
      throw new BadRequestException('عنوان الاشتراك غير مسموح')
    }
    // upsert على endpoint: الجهاز نفسه ينتقل إلى المستخدم الحالي
    this.subscriptions.set(endpoint, { userId, endpoint, ...keys })
  }

  unsubscribe(userId: string, endpoint: string): void {
    if (this.subscriptions.get(endpoint)?.userId === userId) this.subscriptions.delete(endpoint)
  }

  /** يرسل بعد delaySeconds (0 = فوراً) لكل أجهزة المستخدم */
  async send(userId: string, delaySeconds: number): Promise<{ delaySeconds: number }> {
    this.assertReady()
    if (this.subscriptionsOf(userId).length === 0) {
      throw new BadRequestException('لا جهاز مشترك: فعّل الإشعارات على هذا الجهاز أولاً')
    }
    if (delaySeconds <= 0) {
      await this.deliver(userId)
      return { delaySeconds: 0 }
    }
    const mine = [...this.pending.values()].filter((p) => p.userId === userId).length
    if (mine >= MAX_PENDING) {
      throw new BadRequestException(`لا يزيد عدد الإرسالات المجدولة على ${MAX_PENDING}`)
    }
    const timer = setTimeout(() => {
      this.pending.delete(timer)
      void this.deliver(userId)
    }, delaySeconds * 1000)
    this.pending.set(timer, { userId, dueAt: Date.now() + delaySeconds * 1000 })
    return { delaySeconds }
  }

  private subscriptionsOf(userId: string): LabSubscription[] {
    return [...this.subscriptions.values()].filter((s) => s.userId === userId)
  }

  private assertReady(): void {
    if (!this.ready) throw new ServiceUnavailableException('الإشعارات غير مفعّلة على الخادم')
  }

  private async deliver(userId: string): Promise<void> {
    const sentAt = Date.now()
    // sentAt يتيح لـ sw.js حساب زمن الوصول؛ لا اسم ولا هاتف ولا مال في المحتوى
    const payload = JSON.stringify({
      title: 'تجربة إشعار',
      body: `أُرسل ${clock.format(sentAt)}`,
      sentAt,
      tag: 'push-lab',
    })
    for (const sub of this.subscriptionsOf(userId)) {
      let status = 0
      let removed = false
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 600, urgency: 'high' },
        )
        status = res.statusCode
      } catch (error) {
        status = error instanceof webpush.WebPushError ? error.statusCode : 0
        if (status === 404 || status === 410) {
          this.subscriptions.delete(sub.endpoint)
          removed = true
        }
      }
      this.record({ at: new Date().toISOString(), status, removed })
    }
  }

  private record(entry: LabLogEntry): void {
    this.log.unshift(entry)
    this.log.length = Math.min(this.log.length, LOG_SIZE)
    this.logger.log(`Push lab send: status=${entry.status} removed=${entry.removed}`)
  }
}
