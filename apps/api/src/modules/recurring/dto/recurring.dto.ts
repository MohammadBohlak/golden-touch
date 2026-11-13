import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { IsDateOnly, TIME_PATTERN } from '../../../common/validators/is-date-only.validator'
import { MAX_INTERVAL_WEEKS, MAX_ROTATION, MIN_INTERVAL_WEEKS } from '../recurrence'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

/** لا حقل مالي هنا عمداً: سعر كل موعد = سعر خدمته وقت التوليد */
export class CreateRecurringDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'اختر الزبون' })
  customerId: string

  @ApiProperty({
    example: '2026-10-17',
    description: 'تاريخ أول موعد (يوم الدوام) — يحدّد يوم الأسبوع والطور',
  })
  @IsDateOnly()
  startDate: string

  @ApiProperty({ example: '17:00', description: 'وقت الموعد بتوقيت الصالون (HH:mm)' })
  @Matches(TIME_PATTERN, { message: 'الوقت يجب أن يكون بصيغة HH:mm' })
  startTime: string

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 4, description: 'يتكرر كل N أسبوع' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'التكرار يجب أن يكون عدداً صحيحاً' })
  @Min(MIN_INTERVAL_WEEKS, { message: 'أقل تكرار هو كل أسبوع' })
  @Max(MAX_INTERVAL_WEEKS, { message: 'أطول تكرار هو كل 4 أسابيع' })
  intervalWeeks?: number

  @ApiProperty({
    type: [String],
    description: 'خدمة واحدة = ثابتة، أكثر = تناوب بالترتيب (يجوز التكرار)',
  })
  @IsArray({ message: 'اختر الخدمة' })
  @ArrayMinSize(1, { message: 'اختر خدمة واحدة على الأقل' })
  @ArrayMaxSize(MAX_ROTATION, { message: 'أكثر من 6 خدمات في التناوب' })
  @IsUUID('all', { each: true, message: 'الخدمة غير صالحة' })
  serviceIds: string[]

  @ApiPropertyOptional({ nullable: true, description: 'آخر يوم شامل؛ فارغ = مفتوح' })
  @IsOptional()
  @IsDateOnly()
  endDate?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'الملاحظات طويلة جداً' })
  notes?: string | null
}

/** كل الحقول اختيارية؛ endDate: null يمسح التاريخ، و notes: '' يمسحها */
export class UpdateRecurringDto extends PartialType(CreateRecurringDto) {}

export class PreviewRecurringDto extends PartialType(CreateRecurringDto) {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'عند التعديل: السلسلة الموجودة (الحقول غير المذكورة تبقى كما هي)',
  })
  @IsOptional()
  @IsUUID()
  seriesId?: string
}

export class RecurringQueryDto {
  @ApiPropertyOptional({ description: 'تضمين الموقوفة والمنتهية', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeStopped?: boolean

  @ApiPropertyOptional({ format: 'uuid', description: 'حجوزات زبون معيّن (ملف الزبون)' })
  @IsOptional()
  @IsUUID()
  customerId?: string
}
