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
import type { AuthUser } from '../../common/types/auth-user'
import { CreateServiceDto, ServicesQueryDto, UpdateServiceDto } from './dto/service.dto'
import { ServicesService } from './services.service'

/** حقل `price` يصل لمن يملك finance.read فقط (المشرف يرى الاسم والمدة) */
@ApiTags('services')
@ApiCookieAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermissions('services.read')
  @ApiOperation({
    summary: 'خدمات الحلاقة مرتبة',
    description: 'السعر لمن يملك finance.read فقط.',
  })
  findAll(@Query() query: ServicesQueryDto, @CurrentUser() user: AuthUser) {
    return this.services.findAll(query.includeInactive, user)
  }

  @Get(':id')
  @RequirePermissions('services.read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.services.findOne(id, user)
  }

  @Post()
  @RequirePermissions('services.create')
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthUser) {
    return this.services.create(dto, user)
  }

  @Patch(':id')
  @RequirePermissions('services.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.services.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePermissions('services.delete')
  @ApiOperation({ summary: 'حذف خدمة (تُؤرشف إن كانت مرتبطة بحجوزات)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.remove(id)
  }
}
