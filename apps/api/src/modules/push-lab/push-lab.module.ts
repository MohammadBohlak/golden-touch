import { Module } from '@nestjs/common'
import { PushLabController } from './push-lab.controller'
import { PushLabService } from './push-lab.service'

/** المرحلة 0 — تجريبي ومؤقت، يُحذف مع بدء المرحلة 1 (docs/PUSH_NOTIFICATIONS_PLAN.md) */
@Module({
  controllers: [PushLabController],
  providers: [PushLabService],
})
export class PushLabModule {}
