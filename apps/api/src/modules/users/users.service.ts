import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcrypt'
import {
  paginated,
  PaginatedResponse,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto'
import { normalizePhone } from '../../common/utils/phone'
import { PrismaService } from '../../prisma/prisma.service'
import { BCRYPT_ROUNDS } from '../auth/auth.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, name: true, label: true } },
} satisfies Prisma.UserSelect

export type UserDto = Prisma.UserGetPayload<{ select: typeof userSelect }>

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<UserDto>> {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
          ],
        }
      : {}
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ])
    return paginated(items, total, query)
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect })
    if (!user) throw new NotFoundException('المستخدم غير موجود')
    return user
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    await this.assertRole(dto.roleId)
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: normalizePhone(dto.phone),
        isActive: dto.isActive ?? true,
        roleId: dto.roleId,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
      select: userSelect,
    })
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<UserDto> {
    const current = await this.findOne(id)
    if (dto.roleId !== undefined) await this.assertRole(dto.roleId)

    if (
      id === actorId &&
      (dto.isActive === false || (dto.roleId && dto.roleId !== current.role.id))
    ) {
      throw new BadRequestException('لا يمكنك تعطيل حسابك أو تغيير دورك بنفسك')
    }
    const losesAdmin =
      current.role.name === 'admin' &&
      current.isActive &&
      (dto.isActive === false || (dto.roleId !== undefined && dto.roleId !== current.role.id))
    if (losesAdmin) await this.assertNotLastAdmin(id)

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone === undefined ? undefined : normalizePhone(dto.phone),
        isActive: dto.isActive,
        roleId: dto.roleId,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : undefined,
      },
      select: userSelect,
    })
  }

  async remove(id: string, actorId: string): Promise<{ success: true }> {
    if (id === actorId) throw new BadRequestException('لا يمكنك حذف حسابك')
    const user = await this.findOne(id)
    if (user.role.name === 'admin' && user.isActive) await this.assertNotLastAdmin(id)
    await this.prisma.user.delete({ where: { id } })
    return { success: true }
  }

  private async assertRole(roleId: number): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) {
      throw new BadRequestException({
        message: 'الدور المحدد غير موجود',
        errors: { roleId: ['الدور المحدد غير موجود'] },
      })
    }
  }

  private async assertNotLastAdmin(excludeId: string): Promise<void> {
    const admins = await this.prisma.user.count({
      where: { id: { not: excludeId }, isActive: true, role: { name: 'admin' } },
    })
    if (admins === 0) throw new BadRequestException('يجب أن يبقى مدير واحد مفعّل على الأقل')
  }
}
