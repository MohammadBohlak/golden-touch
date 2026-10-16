import { invalidateApiCache } from './useApiState'

export function useAuth() {
  const auth = useAuthStore()
  const { has } = usePermission()

  async function logout(): Promise<void> {
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
