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

  get port(): number {
    return Number(this.config.get('PORT', 4000))
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

  get cookieName(): string {
    return this.config.get<string>('COOKIE_NAME', 'token')
  }
}
