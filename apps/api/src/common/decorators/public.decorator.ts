import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/** يستثني المسار من JwtAuthGuard العام */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
