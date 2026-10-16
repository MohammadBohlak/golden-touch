/** فحص الصلاحيات: يكفي امتلاك واحدة من القائمة */
export function usePermission() {
  const auth = useAuthStore()

  function has(permission: string | string[] | undefined | null): boolean {
    if (!permission || (Array.isArray(permission) && permission.length === 0)) return true
    const list = Array.isArray(permission) ? permission : [permission]
    return list.some((p) => auth.permissions.includes(p))
  }

  return { has }
}
