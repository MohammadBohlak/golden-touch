import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { BookingStatus } from '@prisma/client'
import { AppConfig } from '../../config/app-config'
import { PrismaService } from '../../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import {
  alertWindow,
  buildAlertPayload,
  createdInsideWindow,
  SUBSCRIPTION_MAX_IDLE_DAYS,
  ttlSeconds,
} from './push-alert.calc'
import { PushSenderService } from './push-sender.service'

/** أول فحص بعد الإقلاع بقليل كي لا يزاحم تهيئة الخادم والاتصال الأول بالقاعدة */
export const BOOT_DELAY_MS = 20_000
export const POLL_MS = 60_000
const DAY_MS = 86_400_000

export interface AlertRunResult {
  due: number
  claimed: number
  sent: number
  removed: number
  failed: number
}

/**
 * حلقة كل دقيقة: حجوزات ACTIVE تبدأ خلال `PUSH_ALERT_MINUTES` ولم يُشعَر بها ← إشعار للمدير والمشرف.
 * نمط RecurringSyncService: setInterval بلا مكتبات، معطّلة في الاختبارات وبـ PUSH_ALERT_MINUTES=0
 * وبلا مفاتيح VAPID. أي خطأ يُسجَّل فقط. السجل أعداد فقط — بلا أسماء ولا هواتف.
 * docs/PUSH_NOTIFICATIONS_PLAN.md §5.2
 */
@Injectable()
export class PushAlertService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PushAlertService.name)
  private interval: NodeJS.Timeout | undefined
  private boot: NodeJS.Timeout | undefined
  private running = false

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly sender: PushSenderService,
  ) {}

  onApplicationBootstrap(): void {
    // الترتيب: الإرسال يُفعَّل في onApplicationBootstrap لـ PushSenderService (يسبق هذا لأنه مُعتمَد عليه)
    if (this.config.isTest || this.config.pushAlertMinutes <= 0 || !this.config.vapid) return
    this.boot = setTimeout(() => void this.run(), BOOT_DELAY_MS)
    this.boot.unref()
    this.interval = setInterval(() => void this.run(), POLL_MS)
    this.interval.unref()
    this.logger.log(`Push alerts: ${this.config.pushAlertMinutes} min before start, polling 60s`)
  }

  onModuleDestroy(): void {
    clearTimeout(this.boot)
    clearInterval(this.interval)
  }

  /** دورة واحدة؛ لا تتداخل دورتان */
  async run(now: Date = new Date()): Promise<AlertRunResult | null> {
    if (this.running) return null
    this.running = true
    try {
      const result = await this.process(now)
      if (result.due > 0) {
        this.logger.log(
          `Push alerts: due=${result.due} claimed=${result.claimed} sent=${result.sent} removed=${result.removed} failed=${result.failed}`,
        )
      }
      return result
    } catch (error) {
      this.logger.warn(`Push alerts failed: ${error instanceof Error ? error.message : error}`)
      return null
    } finally {
      this.running = false
    }
  }

  private async process(now: Date): Promise<AlertRunResult> {
    const result: AlertRunResult = { due: 0, claimed: 0, sent: 0, removed: 0, failed: 0 }
    const alertMinutes = this.config.pushAlertMinutes
    const { from, to } = alertWindow(now, alertMinutes)

    const candidates = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACTIVE,
        startAlertSentAt: null,
        startAt: { gt: from, lte: to },
      },
      select: {
        id: true,
        startAt: true,
        createdAt: true,
        serviceName: true,
        customer: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
    })
    // قرار D2: ما أُنشئ داخل النافذة يُتخطّى (يبقى بلا علامة حتى يمرّ موعده)
    const due = candidates.filter((b) => !createdInsideWindow(b, alertMinutes))
    result.due = due.length
    if (due.length === 0) return result

    // بلا مستلمين لا نستهلك الإنذار: من يشترك لاحقاً ضمن النافذة يصله ما تبقّى
    const recipients = await this.recipients(now)
    if (recipients.length === 0) return result

    const { timezone } = await this.settings.get()
    for (const booking of due) {
      // حجز ذرّي: نسخة واحدة فقط تفوز (نشر متداخل أو حلقتان) فلا تكرار
      const claim = await this.prisma.booking.updateMany({
        where: { id: booking.id, startAlertSentAt: null, startAt: booking.startAt },
        data: { startAlertSentAt: now },
      })
      if (claim.count !== 1) continue
      result.claimed++

      const payload = buildAlertPayload(
        {
          id: booking.id,
          customerName: booking.customer.name,
          serviceName: booking.serviceName,
          startAt: booking.startAt,
        },
        now,
        timezone,
      )
      const summary = await this.sender.send(recipients, payload, ttlSeconds(booking.startAt, now))
      result.sent += summary.sent
      result.removed += summary.removed
      result.failed += summary.failed
    }
    return result
  }

  /**
   * أجهزة المستخدمين الفعّالين الذين يملك دورهم notifications.receive، ممن فُتح تطبيقهم
   * خلال عمر الجلسة (جهاز لا يُفتح 30 يوماً لا يُرسَل إليه).
   */
  private recipients(now: Date) {
    return this.prisma.pushSubscription.findMany({
      where: {
        lastSeenAt: { gte: new Date(now.getTime() - SUBSCRIPTION_MAX_IDLE_DAYS * DAY_MS) },
        user: {
          isActive: true,
          role: { permissions: { some: { key: 'notifications.receive' } } },
        },
      },
      select: { endpoint: true, p256dh: true, auth: true },
    })
  }
}
