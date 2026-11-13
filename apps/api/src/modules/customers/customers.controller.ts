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
import { CustomersService } from './customers.service'
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto'

@ApiTags('customers')
@ApiCookieAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers.read')
  @ApiOperation({
    summary: 'الزبائن مع عدد الزيارات وآخر زيارة (بحث بالاسم أو الهاتف)',
    description: 'الزيارات وآخر زيارة لمن يملك bookings.history فقط.',
  })
  findAll(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthUser) {
    return this.customers.findAll(query, user)
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  @ApiOperation({
    summary: 'ملف الزبون: إحصائياته وآخر حجوزاته',
    description:
      'من لا يملك bookings.history: الحجوزات القادمة فقط وبلا زيارات/ملغاة. من لا يملك finance.read: بلا مجموع مدفوع ولا أسعار.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.customers.findOne(id, user)
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
