import { registerDecorator, ValidationOptions } from 'class-validator'
import { isValidDateString } from '../utils/time'

/** يتحقق من تاريخ بصيغة YYYY-MM-DD صالح تقويمياً */
export function IsDateOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options: { message: 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidDateString(value),
      },
    })
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
