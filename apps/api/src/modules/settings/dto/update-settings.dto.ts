import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { TIME_PATTERN } from '../../../common/validators/is-date-only.validator'

export const SLOT_OPTIONS = [5, 10, 15, 20, 30, 60]

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Golden Touch' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'اسم الصالون مطلوب' })
  @MaxLength(60)
  shopName?: string

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'وقت بداية الدوام يجب أن يكون بصيغة HH:mm' })
  openTime?: string

  @ApiPropertyOptional({
    example: '22:00',
    description: 'إن كان أصغر من البداية فهو بعد منتصف الليل',
  })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'وقت نهاية الدوام يجب أن يكون بصيغة HH:mm' })
  closeTime?: string

  @ApiPropertyOptional({ enum: SLOT_OPTIONS, example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(SLOT_OPTIONS, { message: 'دقة المواعيد غير مدعومة' })
  slotMinutes?: number

  @ApiPropertyOptional({ example: 'Asia/Damascus' })
  @IsOptional()
  @IsString()
  timezone?: string

  @ApiPropertyOptional({ type: [Number], example: [5], description: '0 = الأحد … 6 = السبت' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(6, { message: 'لا يمكن أن تكون كل الأيام عطلة' })
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOff?: number[]
}
