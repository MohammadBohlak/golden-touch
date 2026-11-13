import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import type { AuthUser } from '../../common/types/auth-user'
import { BookingsService } from './bookings.service'
import {
  AvailabilityQueryDto,
  BookingsQueryDto,
  CancelBookingDto,
  CompleteBookingDto,
  CreateBookingDto,
  DayQueryDto,
  UpdateBookingDto,
} from './dto/booking.dto'

/**
 * من لا يملك finance.read لا تصله حقول المال (price / paidAmount / summary.revenue / summary.expected)،
 * ومن لا يملك bookings.history لا يرى ما قبل بداية اليوم (يُرفض أو يظهر «غير موجود»).
 */
@ApiTags('bookings')
@ApiCookieAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('day')
  @RequirePermissions('bookings.read')
  @ApiOperation({
    summary: 'جدول يوم: الحجوزات والفراغات المتاحة وملخص اليوم',
    description:
      'الدخل والمتوقع في الملخص لمن يملك finance.read فقط. الأيام السابقة لمن يملك bookings.history.',
  })
  @ApiForbiddenResponse({ description: 'يوم سابق بلا صلاحية السجل' })
  day(@Query() query: DayQueryDto, @CurrentUser() user: AuthUser) {
    return this.bookings.day(query.date, user)
  }

  @Get('availability')
  @RequirePermissions('bookings.read')
  @ApiOperation({ summary: 'أوقات البدء المتاحة لخدمة أو مدة معيّنة في يوم' })
  availability(@Query() query: AvailabilityQueryDto) {
    return this.bookings.availability(query)
  }

  @Get('overdue')
  @RequirePermissions('bookings.read')
  @ApiOperation({
    summary: 'حجوزات انتهى وقتها ولم تُغلق بعد',
    description: 'من لا يملك bookings.history يرى حجوزات اليوم فقط.',
  })
  overdue(@CurrentUser() user: AuthUser) {
    return this.bookings.overdue(user)
  }

  @Get()
  @RequirePermissions('bookings.read')
  @ApiOperation({
    summary: 'سجل الحجوزات مع فلترة وترقيم',
    description: 'من لا يملك bookings.history يحصل على حجوزات اليوم والقادمة فقط مهما كان الفلتر.',
  })
  findAll(@Query() query: BookingsQueryDto, @CurrentUser() user: AuthUser) {
    return this.bookings.findAll(query, user)
  }

  @Get(':id')
  @RequirePermissions('bookings.read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.findOne(id, user)
  }

  @Post()
  @RequirePermissions('bookings.create')
  @ApiOperation({ summary: 'إنشاء حجز (فوري أو مجدول لأي تاريخ قادم)' })
  @ApiConflictResponse({ description: 'الوقت يتداخل مع حجز آخر' })
  @ApiForbiddenResponse({ description: 'سعر مخصص أو تاريخ سابق بلا الصلاحية' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookings.create(dto, user)
  }

  @Patch(':id')
  @RequirePermissions('bookings.update')
  @ApiOperation({ summary: 'تعديل حجز (الموعد/الخدمة/الزبون/الملاحظات)' })
  @ApiConflictResponse({ description: 'الوقت يتداخل مع حجز آخر' })
  @ApiForbiddenResponse({ description: 'تعديل سعر أو مبلغ بلا finance.read، أو نقل لتاريخ سابق' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.update(id, dto, user)
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermissions('bookings.complete')
  @ApiOperation({
    summary: 'إكمال الحجز («تأكيد»)',
    description:
      'بلا جسم: يُسجَّل سعر الحجز مبلغاً مدفوعاً. إرسال paidAmount للمدير فقط (finance.read) وإلا 403.',
  })
  @ApiForbiddenResponse({ description: 'مبلغ صريح بلا finance.read' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.complete(id, dto, user)
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('bookings.cancel')
  @ApiOperation({ summary: 'إلغاء الحجز — يصبح وقته متاحاً لحجز آخر' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.cancel(id, dto, user)
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermissions('bookings.update')
  @ApiOperation({ summary: 'إعادة الحجز إلى "قيد العمل"' })
  @ApiForbiddenResponse({
    description: 'مكتمل عدّل المدير مبلغه — لا يعيد فتحه إلا من يملك finance.read',
  })
  reopen(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.bookings.reopen(id, user)
  }

  @Delete(':id')
  @RequirePermissions('bookings.delete')
  @ApiOperation({ summary: 'حذف الحجز نهائياً (للمدير)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.remove(id)
  }
}
