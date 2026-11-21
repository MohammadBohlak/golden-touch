import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

export class PushKeysDto {
  @ApiProperty()
  @IsString({ message: 'مفتاح الاشتراك غير صالح' })
  @IsNotEmpty({ message: 'مفتاح الاشتراك غير صالح' })
  @MaxLength(256, { message: 'مفتاح الاشتراك غير صالح' })
  p256dh: string

  @ApiProperty()
  @IsString({ message: 'مفتاح الاشتراك غير صالح' })
  @IsNotEmpty({ message: 'مفتاح الاشتراك غير صالح' })
  @MaxLength(256, { message: 'مفتاح الاشتراك غير صالح' })
  auth: string
}

export class SubscribeDto {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/…' })
  @IsString({ message: 'عنوان الاشتراك غير صالح' })
  @IsNotEmpty({ message: 'عنوان الاشتراك غير صالح' })
  @MaxLength(1024, { message: 'عنوان الاشتراك غير صالح' })
  endpoint: string

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto
}

export class UnsubscribeDto {
  @ApiProperty()
  @IsString({ message: 'عنوان الاشتراك غير صالح' })
  @IsNotEmpty({ message: 'عنوان الاشتراك غير صالح' })
  @MaxLength(1024, { message: 'عنوان الاشتراك غير صالح' })
  endpoint: string
}

export class SendTestDto {
  @ApiPropertyOptional({ description: 'التأخير قبل الإرسال بالثواني (0–3600)', example: 60 })
  @IsOptional()
  @IsInt({ message: 'التأخير يجب أن يكون عدداً صحيحاً' })
  @Min(0, { message: 'التأخير لا يقل عن 0' })
  @Max(3600, { message: 'التأخير لا يزيد على ساعة' })
  delaySeconds?: number
}
