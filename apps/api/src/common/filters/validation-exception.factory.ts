import { BadRequestException, ValidationError } from '@nestjs/common'

/** يجمع أخطاء class-validator في { field: [messages] } مع دعم الحقول المتداخلة */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
  out: Record<string, string[]> = {},
): Record<string, string[]> {
  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property
    if (error.constraints) out[path] = Object.values(error.constraints)
    if (error.children?.length) flattenValidationErrors(error.children, path, out)
  }
  return out
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'البيانات المدخلة غير صالحة',
    errors: flattenValidationErrors(errors),
  })
}
