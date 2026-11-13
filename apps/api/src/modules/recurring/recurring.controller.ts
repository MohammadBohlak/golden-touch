import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiConflictResponse, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import {
  CreateRecurringDto,
  PreviewRecurringDto,
  RecurringQueryDto,
  UpdateRecurringDto,
} from './dto/recurring.dto'
import { RecurringBookingsService } from './recurring-bookings.service'

/**
 * الحجوزات الدورية (docs/RECURRING_BOOKINGS_PLAN.md). القالب بلا أي حقل مالي؛ كل موعد يُولَّد كحجز عادي
 * بسعر خدمته وقت التوليد، وحجوزاته المرفقة تتبع قواعد الرؤية المعتادة (المال لمن يملك finance.read).
 */
@ApiTags('recurring-bookings')
@ApiCookieAuth()
@Controller('recurring-bookings')
export class RecurringController {
  constructor(private readonly recurring: RecurringBookingsService) {}

  @Get()
  @RequirePermissions('recurring.read')
  @ApiOperation({
    summary: 'الحجوزات الدورية مع الموعد القادم وما تعذّر إنشاؤه',
    description: 'الفعّالة افتراضياً؛ includeStopped=true تضيف الموقوفة والمنتهية.',
  })
  findAll(@Query() query: RecurringQueryDto) {
    return this.recurring.list(query)
  }

  @Get(':id')
  @RequirePermissions('recurring.read')
  @ApiOperation({ summary: 'تفاصيل حجز دوري: القالب ومواعيده القادمة والمشكلات' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.recurring.findOne(id, user)
  }

  @Post('preview')
  @HttpCode(200)
  @RequirePermissions('recurring.manage')
  @ApiOperation({
    summary: 'معاينة بلا كتابة: المواعيد التي ستُنشأ وما يتعذّر',
    description:
      'بلا seriesId: سلسلة جديدة. مع seriesId: أثر تطبيق الحقول المرسلة على سلسلة قائمة (مع عدد ما سيُحذف وما سيبقى معدّلاً يدوياً).',
  })
  preview(@Body() dto: PreviewRecurringDto) {
    return this.recurring.preview(dto)
  }

  @Post()
  @RequirePermissions('recurring.manage')
  @ApiOperation({
    summary: 'إنشاء حجز دوري وتوليد مواعيده القادمة',
    description:
      'يُرفض (400/409) إن تعذّر الموعد الأول (عطلة/خارج الدوام/خدمة غير متاحة/تداخل/مضى).',
  })
  @ApiConflictResponse({ description: 'الموعد الأول يتداخل مع حجز آخر' })
  create(@Body() dto: CreateRecurringDto, @CurrentUser() user: AuthUser) {
    return this.recurring.create(dto, user)
  }

  @Patch(':id')
  @RequirePermissions('recurring.manage')
  @ApiOperation({
    summary: 'تعديل القالب وإعادة كتابة المواعيد القادمة غير المعدّلة يدوياً',
    description: 'المُلغاة والمكتملة والمعدّلة يدوياً لا تُمسّ. السلسلة الموقوفة لا تُعدَّل (409).',
  })
  @ApiConflictResponse({ description: 'سلسلة موقوفة، أو سباق تداخل — أعد المحاولة' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recurring.update(id, dto, user)
  }

  @Post(':id/stop')
  @HttpCode(200)
  @RequirePermissions('recurring.manage')
  @ApiOperation({
    summary: 'إيقاف الحجز الدوري',
    description:
      'يحذف المواعيد القادمة غير المعدّلة ولا يولّد بعدها. المعدّلة يدوياً تبقى حجوزات عادية.',
  })
  stop(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.recurring.stop(id, user)
  }
}
