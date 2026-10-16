import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import type { AuthUser } from '../../common/types/auth-user'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'قائمة المستخدمين مع ترقيم وبحث' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.users.findAll(query)
  }

  @Get(':id')
  @RequirePermissions('users.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id)
  }

  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'إنشاء حساب — متاح للمدير فقط' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor.id)
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.remove(id, actor.id)
  }
}
