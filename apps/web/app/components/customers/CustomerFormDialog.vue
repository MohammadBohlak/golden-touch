<script setup lang="ts">
import { useForm } from 'vee-validate'
import { object, string } from 'yup'
import type { CustomerRef } from '~/types/api'

const props = defineProps<{ customer?: (CustomerRef & { notes?: string | null }) | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [customer: CustomerRef] }>()

const { $api } = useNuxtApp()
const toast = useToast()
const serverError = ref('')
const isEdit = computed(() => Boolean(props.customer))

const { handleSubmit, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: object({
    name: string().trim().required().max(80).label('الاسم'),
    phone: string()
      .trim()
      .nullable()
      .matches(PHONE_PATTERN, { message: 'رقم الهاتف غير صالح', excludeEmptyString: true }),
    notes: string().trim().nullable().max(500).label('الملاحظات'),
  }),
})

watch(open, (isOpen) => {
  if (!isOpen) return
  serverError.value = ''
  resetForm({
    values: {
      name: props.customer?.name ?? '',
      phone: props.customer?.phone ?? '',
      notes: props.customer?.notes ?? '',
    },
  })
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  const body = { name: values.name, phone: values.phone || '', notes: values.notes || '' }
  try {
    const saved = isEdit.value
      ? await $api<CustomerRef>(`/customers/${props.customer!.id}`, { method: 'PATCH', body })
      : await $api<CustomerRef>('/customers', { method: 'POST', body })
    toast.success(isEdit.value ? 'تم حفظ بيانات الزبون' : 'تمت إضافة الزبون')
    emit('saved', saved)
    open.value = false
  } catch (error) {
    const apiError = toApiError(error)
    serverError.value = apiError.message
    setErrors(fieldErrors(apiError))
  }
})
</script>

<template>
  <AppModal
    v-model:open="open"
    :title="isEdit ? 'تعديل بيانات الزبون' : 'زبون جديد'"
    :persistent="isSubmitting"
  >
    <form id="customer-form" class="flex flex-col gap-4" novalidate @submit="onSubmit">
      <p
        v-if="serverError"
        role="alert"
        class="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
      >
        {{ serverError }}
      </p>
      <FormField v-slot="{ field, id, invalid, describedBy }" name="name" label="الاسم" required>
        <AppInput
          :id="id"
          v-bind="field"
          :invalid="invalid"
          :aria-describedby="describedBy"
          data-autofocus
          maxlength="80"
        />
      </FormField>
      <FormField v-slot="{ field, id, invalid, describedBy }" name="phone" label="رقم الهاتف">
        <AppInput
          :id="id"
          v-bind="field"
          type="tel"
          inputmode="tel"
          dir="ltr"
          placeholder="09xx xxx xxx"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="notes"
        label="ملاحظات"
        hint="مثل تفضيلات القصّة أو الحساسية"
      >
        <AppTextarea
          :id="id"
          :model-value="field.modelValue == null ? '' : String(field.modelValue)"
          :invalid="invalid"
          :aria-describedby="describedBy"
          maxlength="500"
          @update:model-value="field['onUpdate:modelValue']($event)"
          @blur="field.onBlur"
        />
      </FormField>
    </form>
    <template #footer>
      <AppButton variant="secondary" :disabled="isSubmitting" @click="open = false"
        >إلغاء</AppButton
      >
      <AppButton type="submit" form="customer-form" :loading="isSubmitting" icon="check"
        >حفظ</AppButton
      >
    </template>
  </AppModal>
</template>
