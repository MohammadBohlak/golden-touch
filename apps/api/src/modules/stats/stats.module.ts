import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

@Module({
  imports: [SettingsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
