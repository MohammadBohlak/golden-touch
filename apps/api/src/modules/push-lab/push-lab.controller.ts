import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { SendTestDto, SubscribeDto, UnsubscribeDto } from './dto/push-lab.dto'
import { PushLabService } from './push-lab.service'

/** المرحلة 0 (تجريبي ومؤقت) — للمدير وحده عبر settings.update (المشرف لا يملكها) */
@ApiTags('push-lab')
@RequirePermissions('settings.update')
@Controller('push-lab')
export class PushLabController {
  constructor(private readonly push: PushLabService) {}

  @Get('status')
  @ApiOperation({
    summary: 'حالة تجربة الإشعارات: التفعيل، المفتاح العام، الأجهزة، المجدول، آخر الإرسالات',
  })
  status(@CurrentUser() user: AuthUser) {
    return this.push.status(user.id)
  }

  @Post('subscriptions')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'تسجيل اشتراك هذا الجهاز (في الذاكرة فقط)' })
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    this.push.subscribe(user.id, dto.endpoint, dto.keys)
    return { success: true }
  }

  @Delete('subscriptions')
  @HttpCode(200)
  @ApiOperation({ summary: 'إيقاف الإشعارات على هذا الجهاز' })
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    this.push.unsubscribe(user.id, dto.endpoint)
    return { success: true }
  }

  @Post('send')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'إرسال إشعار تجريبي لأجهزتي، فوراً أو بعد تأخير (حتى ساعة)' })
  send(@CurrentUser() user: AuthUser, @Body() dto: SendTestDto) {
    return this.push.send(user.id, dto.delaySeconds ?? 0)
  }
}
