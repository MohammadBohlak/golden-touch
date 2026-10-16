import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger'
import { BookingStatus } from '@prisma/client'
import { Transform, Type } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto'
import { IsDateOnly } from '../../../common/validators/is-date-only.validator'
import { PHONE_PATTERN } from '../../customers/dto/customer.dto'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const MONEY_MAX = 1_000_000_000

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'اختر الخدمة' })
  serviceId: string

  @ApiProperty({ example: '2026-10-16T13:00:00.000Z', description: 'بداية الموعد (ISO 8601)' })
  @IsISO8601({ strict: true }, { message: 'وقت الموعد غير صالح' })
  startAt: string

  @ApiPropertyOptional({ description: 'مدة مخصصة بالدقائق (افتراضياً مدة الخدمة)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'المدة يجب أن تكون عدداً صحيحاً' })
  @Min(5, { message: 'أقل مدة هي 5 دقائق' })
  @Max(480, { message: 'أطول مدة هي 8 ساعات' })
  durationMinutes?: number

  @ApiPropertyOptional({ description: 'سعر متفق عليه (افتراضياً سعر الخدمة)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'السعر يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'السعر لا يمكن أن يكون سالباً' })
  @Max(MONEY_MAX)
  price?: number

  @ApiPropertyOptional({ format: 'uuid', description: 'زبون موجود' })
  @IsOptional()
  @IsUUID('all', { message: 'الزبون غير صالح' })
  customerId?: string

  @ApiPropertyOptional({ description: 'اسم زبون جديد (مطلوب إن لم يُرسل customerId)' })
  @ValidateIf((o: CreateBookingDto) => !o.customerId)
  @Transform(trim)
  @IsString({ message: 'اسم الزبون مطلوب' })
  @IsNotEmpty({ message: 'اسم الزبون مطلوب' })
  @MaxLength(80, { message: 'الاسم طويل جداً' })
  customerName?: string

  @ApiPropertyOptional({ example: '0991234567' })
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, value) => value !== '')
  @Matches(PHONE_PATTERN, { message: 'رقم الهاتف غير صالح' })
  customerPhone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'الملاحظات طويلة جداً' })
  notes?: string
}

export class UpdateBookingDto extends PartialType(OmitType(CreateBookingDto, ['customerName'])) {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'اسم الزبون مطلوب' })
  @MaxLength(80)
  customerName?: string

  @ApiPropertyOptional({ description: 'تصحيح المبلغ المدفوع (للحجوزات المكتملة فقط)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'المبلغ يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'المبلغ لا يمكن أن يكون سالباً' })
  @Max(MONEY_MAX)
  paidAmount?: number
}

export class CompleteBookingDto {
  @ApiProperty({ example: 25000, description: 'المبلغ المدفوع فعلياً من الزبون' })
  @Type(() => Number)
  @IsInt({ message: 'المبلغ يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'المبلغ لا يمكن أن يكون سالباً' })
  @Max(MONEY_MAX)
  paidAmount: number
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'اعتذر الزبون' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: 'سبب الإلغاء طويل جداً' })
  reason?: string
}

export class BookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus, { message: 'حالة الحجز غير صالحة' })
  status?: BookingStatus

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateOnly()
  from?: string

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateOnly()
  to?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @Matches(/^(asc|desc)$/)
  order?: 'asc' | 'desc'
}

export class DayQueryDto {
  @ApiProperty({ example: '2026-10-16' })
  @IsDateOnly()
  date: string
}

export class AvailabilityQueryDto extends DayQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'لحساب المدة من الخدمة' })
  @IsOptional()
  @IsUUID()
  serviceId?: string

  @ApiPropertyOptional({ description: 'مدة مخصصة بالدقائق (تتقدم على مدة الخدمة)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number

  @ApiPropertyOptional({ format: 'uuid', description: 'استثناء حجز (عند تعديل موعده)' })
  @IsOptional()
  @IsUUID()
  excludeId?: string
}
