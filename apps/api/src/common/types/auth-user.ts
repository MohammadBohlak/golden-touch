export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: { id: number; name: string; label: string }
  permissions: string[]
}

export interface JwtPayload {
  sub: string
}
