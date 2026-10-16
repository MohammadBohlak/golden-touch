import { defineStore } from 'pinia'
import type { Paginated, Role, User } from '~/types/api'

export interface UserInput {
  name: string
  email: string
  phone?: string
  password?: string
  roleId: number
  isActive: boolean
}

/** مثال store لميزة كاملة: قائمة مرقّمة + بحث + CRUD (حالة الحوارات تبقى في الصفحة) */
export const useUsersStore = defineStore('users', {
  state: () => ({
    items: [] as User[],
    total: 0,
    page: 1,
    limit: 10,
    search: '',
    roles: [] as Role[],
  }),

  getters: {
    pages: (state) => Math.max(1, Math.ceil(state.total / state.limit)),
  },

  actions: {
    async fetch(signal?: AbortSignal): Promise<Paginated<User>> {
      const { $api } = useNuxtApp()
      const result = await $api<Paginated<User>>('/users', {
        query: { page: this.page, limit: this.limit, search: this.search || undefined },
        signal,
      })
      this.items = result.items
      this.total = result.total
      return result
    },

    async fetchRoles(): Promise<Role[]> {
      if (this.roles.length) return this.roles
      const { $api } = useNuxtApp()
      this.roles = await $api<Role[]>('/roles')
      return this.roles
    },

    async create(input: UserInput): Promise<User> {
      const { $api } = useNuxtApp()
      const user = await $api<User>('/users', { method: 'POST', body: input })
      await this.fetch()
      return user
    },

    async update(id: string, input: Partial<UserInput>): Promise<User> {
      const { $api } = useNuxtApp()
      const user = await $api<User>(`/users/${id}`, { method: 'PATCH', body: input })
      this.items = this.items.map((u) => (u.id === id ? user : u))
      return user
    },

    async remove(id: string): Promise<void> {
      const { $api } = useNuxtApp()
      await $api(`/users/${id}`, { method: 'DELETE' })
      if (this.items.length === 1 && this.page > 1) this.page -= 1
      await this.fetch()
    },
  },
})
