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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import { CustomersService } from './customers.service'
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto'

@ApiTags('customers')
@ApiCookieAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'الزبائن مع عدد الزيارات وآخر زيارة (بحث بالاسم أو الهاتف)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.customers.findAll(query)
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'ملف الزبون: إحصائياته وآخر حجوزاته' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.findOne(id)
  }

  @Post()
  @RequirePermissions('customers.create')
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('customers.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('customers.delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.remove(id)
  }
}
