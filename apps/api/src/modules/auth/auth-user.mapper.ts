import { Prisma } from '@prisma/client'
import type { AuthUser } from '../../common/types/auth-user'

export const authUserInclude = {
  role: { include: { permissions: { select: { key: true } } } },
} satisfies Prisma.UserInclude

export type UserWithRole = Prisma.UserGetPayload<{ include: typeof authUserInclude }>

export function toAuthUser(user: UserWithRole): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: { id: user.role.id, name: user.role.name, label: user.role.label },
    permissions: user.role.permissions.map((p) => p.key).sort(),
  }
}
