import type { Service } from '@prisma/client'

/** الخدمة كما تُرسَل للعميل: `price` غائب تماماً عمّن لا يملك finance.read (D5) */
export type ServiceView = Omit<Service, 'price'> & { price?: number }

export function toServiceView(service: Service, finance: boolean): ServiceView {
  if (finance) return service
  const { price: _price, ...rest } = service
  return rest
}
