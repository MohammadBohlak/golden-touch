import { defineStore } from 'pinia'
import type { Service } from '~/types/api'

export type ServiceInput = Pick<Service, 'name' | 'price' | 'durationMinutes'> &
  Partial<Pick<Service, 'isActive' | 'sortOrder'>>

/** الخدمات تُستخدم في كل نموذج حجز — نحمّلها مرة ونحدّثها محلياً بعد كل تعديل */
export const useServicesStore = defineStore('services', {
  state: () => ({
    items: [] as Service[],
    loaded: false,
    loading: false,
  }),

  getters: {
    active: (state) => state.items.filter((s) => s.isActive),
    byId: (state) => (id: string) => state.items.find((s) => s.id === id),
    minDuration: (state) =>
      Math.min(...state.items.filter((s) => s.isActive).map((s) => s.durationMinutes), 60),
    unpriced: (state) => state.items.filter((s) => s.isActive && s.price === 0),
  },

  actions: {
    async ensure(force = false): Promise<Service[]> {
      if (this.loaded && !force) return this.items
      const { $api } = useNuxtApp()
      this.loading = true
      try {
        this.items = await $api<Service[]>('/services', { query: { includeInactive: true } })
        this.loaded = true
        return this.items
      } finally {
        this.loading = false
      }
    },

    async create(input: ServiceInput): Promise<Service> {
      const { $api } = useNuxtApp()
      const service = await $api<Service>('/services', { method: 'POST', body: input })
      this.items.push(service)
      return service
    },

    async update(id: string, input: Partial<ServiceInput>): Promise<Service> {
      const { $api } = useNuxtApp()
      const service = await $api<Service>(`/services/${id}`, { method: 'PATCH', body: input })
      this.items = this.items.map((s) => (s.id === id ? service : s))
      return service
    },

    async remove(id: string): Promise<{ archived: boolean }> {
      const { $api } = useNuxtApp()
      const result = await $api<{ archived: boolean }>(`/services/${id}`, { method: 'DELETE' })
      this.items = this.items.filter((s) => s.id !== id)
      return result
    },
  },
})
