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
import { ApiConflictResponse, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
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

@ApiTags('bookings')
@ApiCookieAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('day')
  @RequirePermissions('bookings.read')
  @ApiOperation({ summary: 'جدول يوم: الحجوزات والفراغات المتاحة وملخص اليوم' })
  day(@Query() query: DayQueryDto) {
    return this.bookings.day(query.date)
  }

  @Get('availability')
  @RequirePermissions('bookings.read')
  @ApiOperation({ summary: 'أوقات البدء المتاحة لخدمة أو مدة معيّنة في يوم' })
  availability(@Query() query: AvailabilityQueryDto) {
    return this.bookings.availability(query)
  }

  @Get('overdue')
  @RequirePermissions('bookings.read')
  @ApiOperation({ summary: 'حجوزات انتهى وقتها ولم تُغلق بعد' })
  overdue() {
    return this.bookings.overdue()
  }

  @Get()
  @RequirePermissions('bookings.read')
  @ApiOperation({ summary: 'سجل الحجوزات مع فلترة وترقيم' })
  findAll(@Query() query: BookingsQueryDto) {
    return this.bookings.findAll(query)
  }

  @Get(':id')
  @RequirePermissions('bookings.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.findOne(id)
  }

  @Post()
  @RequirePermissions('bookings.create')
  @ApiOperation({ summary: 'إنشاء حجز (فوري أو مجدول لأي تاريخ قادم)' })
  @ApiConflictResponse({ description: 'الوقت يتداخل مع حجز آخر' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookings.create(dto, user)
  }

  @Patch(':id')
  @RequirePermissions('bookings.update')
  @ApiOperation({ summary: 'تعديل حجز (الموعد/الخدمة/الزبون/الملاحظات)' })
  @ApiConflictResponse({ description: 'الوقت يتداخل مع حجز آخر' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookingDto) {
    return this.bookings.update(id, dto)
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermissions('bookings.complete')
  @ApiOperation({ summary: 'إكمال الحجز وتسجيل المبلغ المدفوع' })
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteBookingDto) {
    return this.bookings.complete(id, dto)
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('bookings.cancel')
  @ApiOperation({ summary: 'إلغاء الحجز — يصبح وقته متاحاً لحجز آخر' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto) {
    return this.bookings.cancel(id, dto)
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermissions('bookings.update')
  @ApiOperation({ summary: 'إعادة الحجز إلى "قيد العمل"' })
  reopen(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.reopen(id)
  }

  @Delete(':id')
  @RequirePermissions('bookings.delete')
  @ApiOperation({ summary: 'حذف الحجز نهائياً (للمدير)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.remove(id)
  }
}
