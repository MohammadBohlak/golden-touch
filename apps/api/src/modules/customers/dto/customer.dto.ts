import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export const PHONE_PATTERN = /^\+?[\d\s\-()٠-٩]{6,20}$/

export class CreateCustomerDto {
  @ApiProperty({ example: 'محمد' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'اسم الزبون مطلوب' })
  @MaxLength(80, { message: 'الاسم طويل جداً' })
  name: string

  @ApiPropertyOptional({ example: '0991234567' })
  @IsOptional()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'رقم الهاتف غير صالح' })
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'الملاحظات طويلة جداً' })
  notes?: string
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
