import { BadRequestException, Injectable } from '@nestjs/common'
import type { ShopSettings } from '@prisma/client'
import { isValidTimeZone, toDateString } from '../../common/utils/time'
import { PrismaService } from '../../prisma/prisma.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'

export type SettingsDto = Omit<ShopSettings, 'id' | 'updatedAt'> & { today: string }

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** الإعدادات صف واحد؛ يُنشأ بالقيم الافتراضية إن لم يوجد */
  async get(): Promise<ShopSettings> {
    return (
      (await this.prisma.shopSettings.findUnique({ where: { id: 1 } })) ??
      this.prisma.shopSettings.create({ data: { id: 1 } })
    )
  }

  async getPublic(): Promise<SettingsDto> {
    return this.toDto(await this.get())
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsDto> {
    if (dto.timezone && !isValidTimeZone(dto.timezone)) {
      throw new BadRequestException({
        message: 'المنطقة الزمنية غير صالحة',
        errors: { timezone: ['المنطقة الزمنية غير صالحة'] },
      })
    }
    const current = await this.get()
    const openTime = dto.openTime ?? current.openTime
    const closeTime = dto.closeTime ?? current.closeTime
    if (openTime === closeTime) {
      throw new BadRequestException({
        message: 'وقت بداية الدوام ونهايته لا يمكن أن يكونا متساويين',
        errors: { closeTime: ['يجب أن يختلف عن وقت البداية'] },
      })
    }
    const settings = await this.prisma.shopSettings.update({
      where: { id: 1 },
      data: {
        shopName: dto.shopName,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
        slotMinutes: dto.slotMinutes,
        timezone: dto.timezone,
        daysOff: dto.daysOff ? [...dto.daysOff].sort() : undefined,
      },
    })
    return this.toDto(settings)
  }

  private toDto({ id: _id, updatedAt: _updatedAt, ...settings }: ShopSettings): SettingsDto {
    return { ...settings, today: toDateString(new Date(), settings.timezone) }
  }
}
