import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MIN_TTL_SECONDS } from './push-alert.calc'
import { isAllowedPushEndpoint } from './push-endpoint'
import { PushSenderService } from './push-sender.service'
import type { SubscribeDto } from './dto/push.dto'

/** أقصى عدد أجهزة لكل مستخدم؛ الأقدم استعمالاً يُحذف عند التجاوز */
export const MAX_DEVICES_PER_USER = 10
const MAX_USER_AGENT = 200

@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: PushSenderService,
  ) {}

  publicKey(): { publicKey: string } {
    const publicKey = this.sender.publicKey
    if (!publicKey) throw new ServiceUnavailableException('الإشعارات غير مفعّلة على الخادم')
    return { publicKey }
  }

  /**
   * تسجيل/تحديث اشتراك الجهاز. upsert على endpoint: الجهاز نفسه ينتقل إلى المستخدم الحالي
   * (تبديل الحساب على هاتف واحد) ويُحدَّث lastSeenAt — يستدعيه التطبيق عند كل فتح.
   */
  async subscribe(userId: string, dto: SubscribeDto, userAgent: string | undefined) {
    if (!isAllowedPushEndpoint(dto.endpoint)) {
      throw new BadRequestException({
        message: 'عنوان الاشتراك غير مسموح',
        errors: { endpoint: ['عنوان الاشتراك غير مسموح'] },
      })
    }
    const data = {
      userId,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: userAgent?.slice(0, MAX_USER_AGENT) ?? null,
      lastSeenAt: new Date(),
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { endpoint: dto.endpoint, ...data },
      update: data,
    })

    const surplus = await this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      skip: MAX_DEVICES_PER_USER,
      select: { id: true },
    })
    if (surplus.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { id: { in: surplus.map((s) => s.id) } },
      })
    }
    return { success: true }
  }

  /** إيقاف جهاز المستخدم نفسه فقط — لا يحذف اشتراك غيره حتى لو عرف العنوان */
  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } })
    return { success: true }
  }

  /** إشعار تجريبي لأجهزة المستخدم الحالي */
  async test(userId: string) {
    if (!this.sender.enabled)
      throw new ServiceUnavailableException('الإشعارات غير مفعّلة على الخادم')
    const targets = await this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    })
    if (targets.length === 0) {
      throw new BadRequestException('لا جهاز مشترك: فعّل الإشعارات على هذا الجهاز أولاً')
    }
    const summary = await this.sender.send(
      targets,
      { title: 'إشعار تجريبي', body: 'الإشعارات تعمل على هذا الجهاز', tag: 'push-test' },
      MIN_TTL_SECONDS,
    )
    return { devices: targets.length, ...summary }
  }
}
