import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور الحالية مطلوبة' })
  currentPassword: string

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' })
  @MaxLength(128)
  newPassword: string
}
