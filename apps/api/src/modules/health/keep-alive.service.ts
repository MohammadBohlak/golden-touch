import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { AppConfig } from '../../config/app-config'

/**
 * مهمة دورية (cron) تطلب /api/health عبر الرابط العام كل 10 دقائق افتراضياً.
 * الخطة المجانية على Render تُطفئ الخادم بعد 15 دقيقة بلا طلبات واردة؛ الطلب يمر من موازن Render
 * فيُحسب كحركة واردة، ويستعلم قاعدة البيانات فيبقي مشروع Supabase المجاني نشطاً أيضاً.
 * تعمل فقط إن وُجد RENDER_EXTERNAL_URL أو KEEP_ALIVE_URL (معطّلة محلياً).
 */
@Injectable()
export class KeepAliveService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KeepAliveService.name)
  private timer: NodeJS.Timeout | undefined

  constructor(private readonly config: AppConfig) {}

  onApplicationBootstrap(): void {
    const url = this.config.keepAliveUrl
    if (!url) return
    const interval = this.config.keepAliveIntervalMs
    this.timer = setInterval(() => void this.ping(url), interval)
    this.logger.log(`Keep-alive every ${interval / 60_000} min → ${url}`)
  }

  onModuleDestroy(): void {
    clearInterval(this.timer)
  }

  async ping(url: string): Promise<boolean> {
    const started = Date.now()
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'golden-touch-keep-alive' },
      })
      // سطر واحد كل دورة يظهر في Logs على Render للتأكد أن المهمة تعمل
      if (response.ok) this.logger.log(`Keep-alive ok (${Date.now() - started}ms)`)
      else this.logger.warn(`Keep-alive ping returned ${response.status}`)
      return response.ok
    } catch (error) {
      this.logger.warn(`Keep-alive ping failed: ${error instanceof Error ? error.message : error}`)
      return false
    }
  }
}
