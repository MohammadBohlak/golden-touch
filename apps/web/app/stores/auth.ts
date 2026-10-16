import { defineStore } from 'pinia'
import type { AuthUser } from '~/types/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    /** تم التحقق من الجلسة (نجاحاً أو فشلاً) — يمنع تكرار /auth/me */
    loaded: false,
  }),

  getters: {
    permissions: (state): string[] => state.user?.permissions ?? [],
    isAdmin: (state): boolean => state.user?.role.name === 'admin',
  },

  actions: {
    async fetchMe(): Promise<AuthUser | null> {
      const { $api } = useNuxtApp()
      try {
        this.user = await $api<AuthUser>('/auth/me')
      } catch {
        this.user = null
      } finally {
        this.loaded = true
      }
      return this.user
    },

    async login(email: string, password: string): Promise<AuthUser> {
      const { $api } = useNuxtApp()
      const { user } = await $api<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      this.user = user
      this.loaded = true
      return user
    },

    async logout(): Promise<void> {
      const { $api } = useNuxtApp()
      try {
        await $api('/auth/logout', { method: 'POST' })
      } finally {
        this.clear()
      }
    },

    clear(): void {
      this.user = null
      this.loaded = true
    },
  },
})
