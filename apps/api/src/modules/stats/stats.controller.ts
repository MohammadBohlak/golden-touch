import { Controller, Get, Query } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { StatsQueryDto } from './dto/stats-query.dto'
import { StatsService } from './stats.service'

@ApiTags('stats')
@ApiCookieAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @RequirePermissions('stats.read')
  @ApiOperation({
    summary:
      'إحصائيات فترة: الدخل، الزبائن، ساعات العمل، أكثر الزبائن والخدمات، ومقارنة بالفترة السابقة',
  })
  summary(@Query() query: StatsQueryDto) {
    return this.stats.summary(query.from, query.to)
  }
}
