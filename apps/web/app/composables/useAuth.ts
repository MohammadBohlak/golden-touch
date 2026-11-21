import { invalidateApiCache } from './useApiState'

export function useAuth() {
  const auth = useAuthStore()
  const { has } = usePermission()

  async function logout(): Promise<void> {
    // قبل auth.logout (يحتاج الكوكي): فك اشتراك هذا الجهاز كي لا يستقبل إشعارات الحساب بعد الخروج
    await usePush().releaseDevice()
    await auth.logout()
    invalidateApiCache()
    useServicesStore().$reset()
    useSettingsStore().$reset()
    useUsersStore().$reset()
    await navigateTo('/login', { replace: true })
  }

  return {
    user: computed(() => auth.user),
    isAdmin: computed(() => auth.user?.role.name === 'admin'),
    isLoggedIn: computed(() => Boolean(auth.user)),
    can: has,
    login: auth.login,
    logout,
  }
}
