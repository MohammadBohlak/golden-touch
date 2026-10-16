import { Controller, Get } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PrismaService } from '../../prisma/prisma.service'

@ApiTags('roles')
@ApiCookieAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'الأدوار مع صلاحياتها' })
  async findAll() {
    const roles = await this.prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: {
        permissions: { select: { key: true, description: true }, orderBy: { key: 'asc' } },
        _count: { select: { users: true } },
      },
    })
    return roles.map(({ _count, ...role }) => ({ ...role, usersCount: _count.users }))
  }

  @Get('permissions')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'كل الصلاحيات المعرّفة في النظام' })
  permissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } })
  }
}
