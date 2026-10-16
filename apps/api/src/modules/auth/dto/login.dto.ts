import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class LoginDto {
  @ApiProperty({ example: 'admin@goldentouch.local' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email: string

  @ApiProperty({ example: 'password' })
  @IsString({ message: 'كلمة المرور مطلوبة' })
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MaxLength(128)
  password: string
}
