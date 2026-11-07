/** واجهة Contact Picker (Chrome على أندرويد، سياق آمن HTTPS/localhost). غير متاحة على iOS وسطح المكتب. */
interface ContactsManager {
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<{ name?: string[]; tel?: string[] }[]>
}

export interface PickedContact {
  name: string
  /** أرقام الاتصال الصالحة بصيغة المشروع (فريدة) */
  phones: string[]
}

/**
 * فتح جهات اتصال الجهاز واختيار جهة واحدة. `supported` يصير true بعد التركيب فقط
 * (فلا يختلف HTML الخادم عن العميل). `pick()` يعيد null إن ألغى المستخدم.
 */
export function useContactPicker() {
  const supported = ref(false)

  const manager = (): ContactsManager | undefined =>
    (navigator as Navigator & { contacts?: ContactsManager }).contacts

  onMounted(() => {
    supported.value = 'contacts' in navigator && 'ContactsManager' in window
  })

  async function pick(): Promise<PickedContact | null> {
    const contacts = manager()
    if (!contacts) return null
    try {
      const [contact] = await contacts.select(['name', 'tel'], { multiple: false })
      if (!contact) return null
      const phones = [
        ...new Set((contact.tel ?? []).map(toLocalPhone).filter((p): p is string => Boolean(p))),
      ]
      return { name: contact.name?.[0]?.trim() ?? '', phones }
    } catch (error) {
      // إلغاء المستخدم أو رفضه الإذن ليس خطأً يستحق إشعاراً
      if (error instanceof DOMException && ['AbortError', 'NotAllowedError'].includes(error.name))
        return null
      throw error
    }
  }

  return { supported, pick }
}
