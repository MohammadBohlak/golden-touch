/**
 * فحص الصلاحيات (منطق نقي): يكفي امتلاك واحدة من المطلوب. المطلوب الفارغ = متاح للجميع.
 * مصدر واحد للقوائم (`config/navigation.ts`) و`usePermission` و`v-perm` والاختبارات.
 */
export function hasAnyPermission(
  granted: readonly string[],
  required: string | readonly string[] | undefined | null,
): boolean {
  if (!required || (Array.isArray(required) && required.length === 0)) return true
  const list: readonly string[] = typeof required === 'string' ? [required] : required
  return list.some((p) => granted.includes(p))
}
