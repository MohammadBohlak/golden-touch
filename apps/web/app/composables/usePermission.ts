/** فحص الصلاحيات: يكفي امتلاك واحدة من القائمة (المنطق في utils/permissions.ts) */
export function usePermission() {
  const auth = useAuthStore()

  function has(permission: string | string[] | undefined | null): boolean {
    return hasAnyPermission(auth.permissions, permission)
  }

  return { has }
}
