import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }

/** يحوّل "30d" أو "12h" أو "3600" إلى عدد ثوانٍ */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd]?)$/.exec(value.trim())
  if (!match) throw new Error(`Invalid duration: ${value}`)
  return Number(match[1]) * (UNIT_SECONDS[match[2] || 's'] ?? 1)
}

/** واجهة مكتوبة النوع فوق ConfigService بدلاً من نشر أسماء المتغيرات في كل مكان */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production'
  }

  get isTest(): boolean {
    return this.config.get<string>('NODE_ENV') === 'test'
  }

  get port(): number {
    return Number(this.config.get('PORT', 4000))
  }

  get host(): string | undefined {
    return this.config.get<string>('API_HOST') || undefined
  }

  get jwtSecret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET')
  }

  get jwtExpiresInSeconds(): number {
    return durationToSeconds(this.config.get<string>('JWT_EXPIRES_IN', '30d'))
  }

  /** رابط الموقع العام على Render (يُضبط تلقائياً هناك) */
  get publicUrl(): string | undefined {
    return this.config.get<string>('RENDER_EXTERNAL_URL') || undefined
  }

  get corsOrigins(): string[] {
    const origins = this.config
      .get<string>('CORS_ORIGIN', 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
    return this.publicUrl ? [...new Set([...origins, this.publicUrl])] : origins
  }

  /** الرابط الذي يُطلب دورياً لإبقاء الخادم مستيقظاً (معطّل إن لم يوجد) */
  get keepAliveUrl(): string | undefined {
    const base = this.config.get<string>('KEEP_ALIVE_URL') || this.publicUrl
    return base ? new URL('/api/health', base).toString() : undefined
  }

  get keepAliveIntervalMs(): number {
    return Number(this.config.get('KEEP_ALIVE_INTERVAL_MINUTES', 10)) * 60_000
  }

  /** أفق توليد الحجوزات الدورية بالأيام (docs/RECURRING_BOOKINGS_PLAN.md D1) */
  get recurringHorizonDays(): number {
    return Number(this.config.get('RECURRING_HORIZON_DAYS', 56))
  }

  /** فاصل مزامنة الحجوزات الدورية بالدقائق؛ 0 = معطّلة */
  get recurringSyncMinutes(): number {
    return Number(this.config.get('RECURRING_SYNC_MINUTES', 360))
  }

  /** مفاتيح VAPID لـ Web Push — بدونها تُعطَّل الميزة بهدوء (docs/PUSH_NOTIFICATIONS_PLAN.md §5.3) */
  get vapid(): { publicKey: string; privateKey: string; subject: string } | undefined {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY')
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY')
    if (!publicKey || !privateKey) return undefined
    const subject =
      this.config.get<string>('VAPID_SUBJECT') || this.publicUrl || 'https://localhost'
    return { publicKey, privateKey, subject }
  }

  /** الإنذار قبل بداية الموعد بالدقائق لإشعارات الطاقم؛ 0 = معطّل (docs/PUSH_NOTIFICATIONS_PLAN.md D3) */
  get pushAlertMinutes(): number {
    return Number(this.config.get('PUSH_ALERT_MINUTES', 15))
  }

  get cookieName(): string {
    return this.config.get<string>('COOKIE_NAME', 'token')
  }
}
