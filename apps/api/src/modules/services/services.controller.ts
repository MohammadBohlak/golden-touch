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
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { CreateServiceDto, ServicesQueryDto, UpdateServiceDto } from './dto/service.dto'
import { ServicesService } from './services.service'

@ApiTags('services')
@ApiCookieAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermissions('services.read')
  @ApiOperation({ summary: 'خدمات الحلاقة مرتبة' })
  findAll(@Query() query: ServicesQueryDto) {
    return this.services.findAll(query.includeInactive)
  }

  @Get(':id')
  @RequirePermissions('services.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.findOne(id)
  }

  @Post()
  @RequirePermissions('services.create')
  create(@Body() dto: CreateServiceDto) {
    return this.services.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('services.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('services.delete')
  @ApiOperation({ summary: 'حذف خدمة (تُؤرشف إن كانت مرتبطة بحجوزات)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.remove(id)
  }
}
