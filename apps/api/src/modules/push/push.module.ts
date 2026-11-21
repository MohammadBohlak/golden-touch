import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { PushAlertService } from './push-alert.service'
import { PushSenderService } from './push-sender.service'
import { PushController } from './push.controller'
import { PushService } from './push.service'

/** إشعارات المواعيد للطاقم (Web Push) — docs/PUSH_NOTIFICATIONS_PLAN.md */
@Module({
  imports: [SettingsModule],
  controllers: [PushController],
  providers: [PushService, PushSenderService, PushAlertService],
})
export class PushModule {}
