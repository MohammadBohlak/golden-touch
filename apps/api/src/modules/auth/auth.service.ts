import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcrypt'
import type { AuthUser, JwtPayload } from '../../common/types/auth-user'
import { PrismaService } from '../../prisma/prisma.service'
import { authUserInclude, toAuthUser } from './auth-user.mapper'

export const BCRYPT_ROUNDS = 12
const INVALID_CREDENTIALS = 'البريد الإلكتروني أو كلمة المرور غير صحيحة'

@Injectable()
export class AuthService {
  /** hash وهمي للمقارنة عند عدم وجود المستخدم (يحمي من كشف الحسابات بزمن الاستجابة) */
  private readonly dummyHash = bcrypt.hash('golden-touch-dummy', BCRYPT_ROUNDS)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: authUserInclude,
    })
    // نقارن دائماً حتى لا يكشف زمن الاستجابة وجود البريد من عدمه
    const hash = user?.passwordHash ?? (await this.dummyHash)
    const valid = await bcrypt.compare(password, hash)
    if (!user || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS)
    if (!user.isActive) throw new UnauthorizedException('هذا الحساب موقوف، تواصل مع المدير')

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const payload: JwtPayload = { sub: user.id }
    return { token: await this.jwt.signAsync(payload), user: toAuthUser(user) }
  }

  /** يُستدعى من JwtStrategy في كل طلب — المستخدم الموقوف يُطرد فوراً */
  async validateUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: authUserInclude,
    })
    return user?.isActive ? toAuthUser(user) : null
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        message: 'كلمة المرور الحالية غير صحيحة',
        errors: { currentPassword: ['كلمة المرور الحالية غير صحيحة'] },
      })
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    })
  }
}
