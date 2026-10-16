import { defineStore } from 'pinia'
import type { ShopSettings } from '~/types/api'

/** طلب جارٍ مشترك بين المكوّنات على المتصفح (خارج الـ state لأنه غير قابل للتسلسل في SSR) */
let pending: Promise<ShopSettings> | null = null

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: null as ShopSettings | null,
  }),

  actions: {
    /** يحمّل الإعدادات مرة واحدة ويشارك نفس الطلب بين المكوّنات */
    async ensure(force = false): Promise<ShopSettings> {
      if (this.settings && !force) return this.settings
      const { $api } = useNuxtApp()
      if (import.meta.server) return (this.settings = await $api<ShopSettings>('/settings'))
      pending ??= $api<ShopSettings>('/settings')
      try {
        this.settings = await pending
        return this.settings
      } finally {
        pending = null
      }
    },

    async update(patch: Partial<Omit<ShopSettings, 'today'>>): Promise<ShopSettings> {
      const { $api } = useNuxtApp()
      this.settings = await $api<ShopSettings>('/settings', { method: 'PATCH', body: patch })
      return this.settings
    },
  },
})
