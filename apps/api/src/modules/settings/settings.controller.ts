import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { UpdateSettingsDto } from './dto/update-settings.dto'
import { SettingsService } from './settings.service'

@ApiTags('settings')
@ApiCookieAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'إعدادات الصالون (ساعات الدوام، دقة المواعيد، العطل…)' })
  get() {
    return this.settings.getPublic()
  }

  @Patch()
  @RequirePermissions('settings.update')
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto)
  }
}
