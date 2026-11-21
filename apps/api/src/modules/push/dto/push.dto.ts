import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsString, MaxLength, ValidateNested } from 'class-validator'

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
  // IsObject: ValidateNested وحده يتجاوز القيمة الغائبة فيصير الخطأ 500 لا 400
  @IsObject({ message: 'مفاتيح الاشتراك مطلوبة' })
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
