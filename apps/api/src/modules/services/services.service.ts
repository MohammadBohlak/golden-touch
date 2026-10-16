import { Injectable, NotFoundException } from '@nestjs/common'
import type { Service } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto'

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(includeInactive = false): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { archivedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.prisma.service.findFirst({ where: { id, archivedAt: null } })
    if (!service) throw new NotFoundException('الخدمة غير موجودة')
    return service
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const sortOrder =
      dto.sortOrder ??
      ((await this.prisma.service.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1
    return this.prisma.service.create({ data: { ...dto, sortOrder } })
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    await this.findOne(id)
    return this.prisma.service.update({ where: { id }, data: dto })
  }

  /** الخدمة المرتبطة بحجوزات تُؤرشف (حذف ناعم) حتى يبقى سجل الحجوزات والإحصائيات سليماً */
  async remove(id: string): Promise<{ archived: boolean }> {
    await this.findOne(id)
    const used = await this.prisma.booking.count({ where: { serviceId: id } })
    if (used > 0) {
      await this.prisma.service.update({
        where: { id },
        data: { archivedAt: new Date(), isActive: false },
      })
      return { archived: true }
    }
    await this.prisma.service.delete({ where: { id } })
    return { archived: false }
  }
}
