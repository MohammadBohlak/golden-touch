import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

/** حارس عام على كل المسارات إلا المعلَّمة بـ @Public() */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(context)
  }

  handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (err instanceof UnauthorizedException) throw err
    if (err || !user) throw new UnauthorizedException('يجب تسجيل الدخول أولاً')
    return user
  }
}
