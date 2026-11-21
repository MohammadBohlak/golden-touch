import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import webpush from 'web-push'
import { AppConfig } from '../../config/app-config'
import { PrismaService } from '../../prisma/prisma.service'
import type { AlertPayload } from './push-alert.calc'

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

export interface SendSummary {
  sent: number
  /** اشتراكات سقطت (404/410) فحُذفت */
  removed: number
  failed: number
}

/** استجابات تُعاد محاولتها مرة واحدة فوراً: ضغط الخدمة أو عطل مؤقت أو شبكة (status 0) */
const isTransient = (status: number) => status === 0 || status === 429 || status >= 500

/**
 * قناة الإرسال الوحيدة لـ Web Push (التشفير الطرفي وتوقيع VAPID في مكتبة web-push).
 * بلا مفاتيح VAPID تبقى معطّلة بهدوء ولا تمسّ الإقلاع. السجل أعداد ورموز حالة فقط.
 */
@Injectable()
export class PushSenderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PushSenderService.name)
  private ready = false

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    const vapid = this.config.vapid
    if (!vapid) {
      this.logger.log('Web Push disabled: VAPID keys not set')
      return
    }
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
    this.ready = true
    this.logger.log('Web Push enabled')
  }

  get enabled(): boolean {
    return this.ready
  }

  get publicKey(): string | undefined {
    return this.ready ? this.config.vapid?.publicKey : undefined
  }

  /** يرسل الحمولة لكل الأجهزة؛ لا يرمي أبداً (الفشل يُحصى فقط) */
  async send(
    targets: PushTarget[],
    payload: AlertPayload,
    ttlSeconds: number,
  ): Promise<SendSummary> {
    const summary: SendSummary = { sent: 0, removed: 0, failed: 0 }
    if (!this.ready || targets.length === 0) return summary
    const body = JSON.stringify(payload)

    await Promise.all(
      targets.map(async (target) => {
        let status = await this.attempt(target, body, ttlSeconds)
        if (isTransient(status)) status = await this.attempt(target, body, ttlSeconds)

        if (status >= 200 && status < 300) summary.sent++
        else if (status === 404 || status === 410) {
          // الاشتراك انتهى (حُذف التطبيق أو أُلغي الإذن): نحذفه ويعيد المستخدم التفعيل
          await this.prisma.pushSubscription.deleteMany({ where: { endpoint: target.endpoint } })
          summary.removed++
        } else {
          if (status === 403) this.logger.warn('Push rejected (403): check VAPID keys')
          summary.failed++
        }
      }),
    )
    return summary
  }

  /** محاولة واحدة؛ ترجع رمز الحالة (0 = فشل شبكة) */
  private async attempt(target: PushTarget, body: string, ttl: number): Promise<number> {
    try {
      const res = await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        body,
        { TTL: ttl, urgency: 'high' },
      )
      return res.statusCode
    } catch (error) {
      return error instanceof webpush.WebPushError ? error.statusCode : 0
    }
  }
}
