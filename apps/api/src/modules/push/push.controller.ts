import { Body, Controller, Delete, Get, Headers, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { SubscribeDto, UnsubscribeDto } from './dto/push.dto'
import { PushService } from './push.service'

/** إشعارات المواعيد: للمدير والمشرف (notifications.receive) — الإشعار بلا مال ولا سجل */
@ApiTags('push')
@RequirePermissions('notifications.receive')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  @ApiOperation({ summary: 'مفتاح VAPID العام لاشتراك المتصفح (503 إن لم تُضبط المفاتيح)' })
  publicKey() {
    return this.push.publicKey()
  }

  @Post('subscriptions')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'تسجيل/تحديث اشتراك هذا الجهاز (ينقل ملكيته للمستخدم الحالي)' })
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.subscribe(user.id, dto, userAgent)
  }

  @Delete('subscriptions')
  @HttpCode(200)
  @ApiOperation({ summary: 'إيقاف الإشعارات على هذا الجهاز (وعند تسجيل الخروج)' })
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(user.id, dto.endpoint)
  }

  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'إشعار تجريبي لأجهزتي' })
  test(@CurrentUser() user: AuthUser) {
    return this.push.test(user.id)
  }
}
