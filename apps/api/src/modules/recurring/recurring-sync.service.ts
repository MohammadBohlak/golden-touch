import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { AppConfig } from '../../config/app-config'
import { RecurringService } from './recurring.service'

/** أول تشغيل بعد الإقلاع بقليل كي لا يزاحم تهيئة الخادم والاتصال الأول بالقاعدة */
export const BOOT_DELAY_MS = 20_000

/**
 * مزامنة دورية تسدّ فراغات الحجوزات الدورية (يمتد الأفق مع الأيام وتتدارك ما فات أثناء توقف الخادم).
 * نمط KeepAliveService: setInterval بلا مكتبات. معطّلة في الاختبارات أو بـ RECURRING_SYNC_MINUTES=0.
 * أي خطأ يُسجَّل فقط — لا يمسّ الحجوزات ولا /api/health. السجل أعداد فقط، بلا أسماء ولا هواتف.
 */
@Injectable()
export class RecurringSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RecurringSyncService.name)
  private interval: NodeJS.Timeout | undefined
  private boot: NodeJS.Timeout | undefined
  private running = false

  constructor(
    private readonly config: AppConfig,
    private readonly recurring: RecurringService,
  ) {}

  onApplicationBootstrap(): void {
    const minutes = this.config.recurringSyncMinutes
    if (this.config.isTest || minutes <= 0) return
    this.boot = setTimeout(() => void this.run(), BOOT_DELAY_MS)
    this.boot.unref()
    this.interval = setInterval(() => void this.run(), minutes * 60_000)
    this.interval.unref()
    this.logger.log(`Recurring sync every ${minutes} min`)
  }

  onModuleDestroy(): void {
    clearTimeout(this.boot)
    clearInterval(this.interval)
  }

  /** دورة واحدة؛ لا تتداخل دورتان */
  async run(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const r = await this.recurring.syncAll()
      this.logger.log(
        `Recurring sync ok: series=${r.series} created=${r.created} issues=${r.issues} failed=${r.failed}`,
      )
    } catch (error) {
      this.logger.warn(`Recurring sync failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      this.running = false
    }
  }
}
