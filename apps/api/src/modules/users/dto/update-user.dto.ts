import { PartialType } from '@nestjs/swagger'
import { CreateUserDto } from './create-user.dto'

/** كل الحقول اختيارية — كلمة المرور تُغيَّر فقط إن أُرسلت */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
