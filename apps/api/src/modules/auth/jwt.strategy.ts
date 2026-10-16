import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import type { Request } from 'express'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { AuthUser, JwtPayload } from '../../common/types/auth-user'
import { AppConfig } from '../../config/app-config'
import { AuthService } from './auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfig,
    private readonly auth: AuthService,
  ) {
    const cookieName = config.cookieName
    super({
      // الكوكي أولاً ثم ترويسة Authorization: Bearer
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[cookieName] as string | undefined) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    })
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.auth.validateUser(payload.sub)
    if (!user) throw new UnauthorizedException('انتهت الجلسة، يرجى تسجيل الدخول مجدداً')
    return user
  }
}
