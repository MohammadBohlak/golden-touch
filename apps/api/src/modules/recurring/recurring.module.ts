import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { RecurringBookingsService } from './recurring-bookings.service'
import { RecurringSyncService } from './recurring-sync.service'
import { RecurringController } from './recurring.controller'
import { RecurringService } from './recurring.service'

@Module({
  imports: [SettingsModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringBookingsService, RecurringSyncService],
  exports: [RecurringService],
})
export class RecurringModule {}
