import { Injectable, NotFoundException } from '@nestjs/common'
import type { Service } from '@prisma/client'
import type { AuthUser } from '../../common/types/auth-user'
import { PrismaService } from '../../prisma/prisma.service'
import { capsOf } from '../bookings/booking.visibility'
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto'
import { ServiceView, toServiceView } from './service.visibility'

/** كل الاستجابات تمرّ بـ toServiceView: من لا يملك finance.read لا يستلم السعر أصلاً */
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false, actor: AuthUser): Promise<ServiceView[]> {
    const services = await this.prisma.service.findMany({
      where: { archivedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    const { finance } = capsOf(actor)
    return services.map((s) => toServiceView(s, finance))
  }

  async findOne(id: string, actor: AuthUser): Promise<ServiceView> {
    return toServiceView(await this.getRaw(id), capsOf(actor).finance)
  }

  async create(dto: CreateServiceDto, actor: AuthUser): Promise<ServiceView> {
    const sortOrder =
      dto.sortOrder ??
      ((await this.prisma.service.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1
    const created = await this.prisma.service.create({ data: { ...dto, sortOrder } })
    return toServiceView(created, capsOf(actor).finance)
  }

  async update(id: string, dto: UpdateServiceDto, actor: AuthUser): Promise<ServiceView> {
    await this.getRaw(id)
    const updated = await this.prisma.service.update({ where: { id }, data: dto })
    return toServiceView(updated, capsOf(actor).finance)
  }

  /** الخدمة المرتبطة بحجوزات أو بحجز دوري تُؤرشف (حذف ناعم) حتى يبقى سجل الحجوزات والإحصائيات سليماً */
  async remove(id: string): Promise<{ archived: boolean }> {
    await this.getRaw(id)
    // حجوزات أو تناوب حجز دوري: الحذف الفعلي يكسر المفتاح الأجنبي ويفقد السجل → أرشفة
    const [bookings, recurring] = await Promise.all([
      this.prisma.booking.count({ where: { serviceId: id } }),
      this.prisma.recurringBookingService.count({ where: { serviceId: id } }),
    ])
    if (bookings + recurring > 0) {
      await this.prisma.service.update({
        where: { id },
        data: { archivedAt: new Date(), isActive: false },
      })
      return { archived: true }
    }
    await this.prisma.service.delete({ where: { id } })
    return { archived: false }
  }

  private async getRaw(id: string): Promise<Service> {
    const service = await this.prisma.service.findFirst({ where: { id, archivedAt: null } })
    if (!service) throw new NotFoundException('الخدمة غير موجودة')
    return service
  }
}
