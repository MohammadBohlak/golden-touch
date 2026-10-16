import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateServiceDto {
  @ApiProperty({ example: 'شعر وذقن' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'اسم الخدمة مطلوب' })
  @MaxLength(60, { message: 'اسم الخدمة طويل جداً' })
  name: string

  @ApiProperty({ example: 25000, description: 'السعر الافتراضي بالليرة السورية' })
  @Type(() => Number)
  @IsInt({ message: 'السعر يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'السعر لا يمكن أن يكون سالباً' })
  @Max(1_000_000_000, { message: 'السعر كبير جداً' })
  price: number

  @ApiProperty({ example: 60, description: 'مدة التنفيذ بالدقائق' })
  @Type(() => Number)
  @IsInt({ message: 'المدة يجب أن تكون عدداً صحيحاً من الدقائق' })
  @Min(5, { message: 'أقل مدة هي 5 دقائق' })
  @Max(480, { message: 'أطول مدة هي 8 ساعات' })
  durationMinutes: number

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class ServicesQueryDto {
  @ApiPropertyOptional({ description: 'تضمين الخدمات المعطّلة', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeInactive?: boolean
}
