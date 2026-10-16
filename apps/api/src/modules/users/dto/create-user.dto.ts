import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CreateUserDto {
  @ApiProperty({ example: 'أحمد' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @MaxLength(80, { message: 'الاسم طويل جداً' })
  name: string

  @ApiProperty({ example: 'ahmad@goldentouch.local' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  @MaxLength(128)
  password: string

  @ApiPropertyOptional({ example: '0991234567' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20, { message: 'رقم الهاتف طويل جداً' })
  phone?: string

  @ApiProperty({ example: 2, description: 'معرّف الدور' })
  @Type(() => Number)
  @IsInt({ message: 'الدور مطلوب' })
  roleId: number

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
