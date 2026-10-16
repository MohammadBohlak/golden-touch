<script setup lang="ts">
import { useForm } from 'vee-validate'
import { boolean, number, object, string } from 'yup'
import type { Service } from '~/types/api'

const props = defineProps<{ service?: Service | null }>()
const open = defineModel<boolean>('open', { default: false })

const servicesStore = useServicesStore()
const toast = useToast()
const serverError = ref('')
const isEdit = computed(() => Boolean(props.service))

const DURATIONS = [15, 20, 30, 45, 60, 90]

const { handleSubmit, isSubmitting, resetForm, setErrors, values, setFieldValue } = useForm({
  validationSchema: object({
    name: string().trim().required().max(60).label('اسم الخدمة'),
    price: number().typeError('أدخل السعر').required().integer().min(0).label('السعر'),
    durationMinutes: number()
      .typeError('أدخل المدة')
      .required()
      .integer()
      .min(5)
      .max(480)
      .label('المدة'),
    isActive: boolean(),
  }),
})

watch(open, (isOpen) => {
  if (!isOpen) return
  serverError.value = ''
  resetForm({
    values: {
      name: props.service?.name ?? '',
      price: props.service?.price ?? undefined,
      durationMinutes: props.service?.durationMinutes ?? 30,
      isActive: props.service?.isActive ?? true,
    },
  })
})

const onSubmit = handleSubmit(async (form) => {
  serverError.value = ''
  const body = {
    name: form.name,
    price: form.price,
    durationMinutes: form.durationMinutes,
    isActive: form.isActive ?? true,
  }
  try {
    if (isEdit.value) await servicesStore.update(props.service!.id, body)
    else await servicesStore.create(body)
    toast.success(isEdit.value ? 'تم حفظ الخدمة' : 'تمت إضافة الخدمة')
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
    :title="isEdit ? 'تعديل الخدمة' : 'خدمة جديدة'"
    :persistent="isSubmitting"
  >
    <form id="service-form" class="flex flex-col gap-4" novalidate @submit="onSubmit">
      <p
        v-if="serverError"
        role="alert"
        class="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
      >
        {{ serverError }}
      </p>
      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="name"
        label="اسم الخدمة"
        required
      >
        <AppInput
          :id="id"
          v-bind="field"
          :invalid="invalid"
          :aria-describedby="describedBy"
          placeholder="مثلاً: شعر وذقن"
          data-autofocus
        />
      </FormField>

      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="price"
        label="السعر الافتراضي"
        hint="يظهر تلقائياً عند إكمال الحجز، ويمكن تعديله لكل زبون"
        required
      >
        <AppMoneyInput
          :id="id"
          :model-value="asNumber(field.modelValue)"
          :invalid="invalid"
          :aria-describedby="describedBy"
          @update:model-value="field['onUpdate:modelValue']($event)"
          @blur="field.onBlur"
        />
      </FormField>

      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="durationMinutes"
        label="مدة التنفيذ (بالدقائق)"
        required
      >
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap gap-2" role="group" aria-label="مدد شائعة">
            <button
              v-for="d in DURATIONS"
              :key="d"
              type="button"
              :aria-pressed="values.durationMinutes === d"
              :class="
                cn(
                  'h-10 rounded-full border px-3.5 text-sm font-bold transition-colors',
                  values.durationMinutes === d
                    ? 'border-ink-950 bg-ink-950 text-gold-300'
                    : 'border-line-strong hover:border-gold-500',
                )
              "
              @click="setFieldValue('durationMinutes', d)"
            >
              {{ formatDuration(d) }}
            </button>
          </div>
          <AppInput
            :id="id"
            :model-value="asNumber(field.modelValue)"
            type="number"
            inputmode="numeric"
            min="5"
            max="480"
            step="5"
            dir="ltr"
            :invalid="invalid"
            :aria-describedby="describedBy"
            @update:model-value="field['onUpdate:modelValue'](parseInteger($event))"
            @blur="field.onBlur"
          />
        </div>
      </FormField>

      <AppSwitch
        :model-value="values.isActive ?? true"
        label="الخدمة فعّالة"
        description="الخدمات المعطّلة لا تظهر عند إنشاء حجز جديد"
        @update:model-value="setFieldValue('isActive', $event)"
      />
    </form>
    <template #footer>
      <AppButton variant="secondary" :disabled="isSubmitting" @click="open = false"
        >إلغاء</AppButton
      >
      <AppButton type="submit" form="service-form" :loading="isSubmitting" icon="check"
        >حفظ</AppButton
      >
    </template>
  </AppModal>
</template>
