<script setup lang="ts">
/**
 * زر داخل خانة #end في حقل الهاتف: يفتح جهات اتصال الجهاز ويضع رقم الجهة المختارة في الحقل.
 * يظهر فقط حيث تدعم الواجهة (Chrome أندرويد عبر HTTPS)؛ وإن كان للجهة أكثر من رقم يُعرض اختيار.
 *
 *   <AppInput …>
 *     <template v-if="contactsSupported" #end>
 *       <PhoneContactButton @pick="field['onUpdate:modelValue']($event)" />
 *     </template>
 *   </AppInput>
 *
 * استعمل `useContactPicker().supported` في الأب لشرط الخانة كي لا يُحجز لها هامش حين لا تُدعم.
 */
const emit = defineEmits<{ pick: [phone: string] }>()

const { pick } = useContactPicker()
const toast = useToast()

const busy = ref(false)
const chooser = ref(false)
const candidate = ref<PickedContact | null>(null)

async function open() {
  if (busy.value) return
  busy.value = true
  try {
    const contact = await pick()
    if (!contact) return
    if (!contact.phones.length) {
      toast.info('لا يحتوي هذا الاتصال على رقم هاتف')
    } else if (contact.phones.length === 1) {
      emit('pick', contact.phones[0]!)
    } else {
      candidate.value = contact
      chooser.value = true
    }
  } catch {
    toast.error('تعذّر فتح جهات الاتصال')
  } finally {
    busy.value = false
  }
}

function choose(phone: string) {
  emit('pick', phone)
  chooser.value = false
}
</script>

<template>
  <button
    type="button"
    class="grid size-11 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted"
    aria-label="اختيار رقم من جهات الاتصال"
    :aria-busy="busy || undefined"
    @click="open"
  >
    <AppIcon name="contact" :size="20" />
  </button>

  <AppModal v-model:open="chooser" size="sm" title="اختر رقماً" :description="candidate?.name">
    <ul class="flex flex-col gap-2">
      <li v-for="phone in candidate?.phones" :key="phone">
        <button
          type="button"
          dir="ltr"
          class="flex h-12 w-full items-center justify-center rounded-xl border border-line-strong text-lg font-bold tabular-nums hover:border-gold-500 hover:bg-surface-muted"
          @click="choose(phone)"
        >
          {{ phone }}
        </button>
      </li>
    </ul>
  </AppModal>
</template>
