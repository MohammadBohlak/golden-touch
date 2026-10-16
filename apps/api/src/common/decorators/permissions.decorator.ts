import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiForbiddenResponse } from '@nestjs/swagger'

export const PERMISSIONS_KEY = 'permissions'

/** يتطلب امتلاك المستخدم لكل الصلاحيات المذكورة (صيغة resource.action) */
export const RequirePermissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    ApiForbiddenResponse({ description: `يتطلب الصلاحية: ${permissions.join('، ')}` }),
  )
