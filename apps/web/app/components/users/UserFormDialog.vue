<script setup lang="ts">
import { useForm } from 'vee-validate'
import { boolean, number, object, string } from 'yup'
import type { User } from '~/types/api'

const props = defineProps<{ user?: User | null }>()
const open = defineModel<boolean>('open', { default: false })

const usersStore = useUsersStore()
const toast = useToast()
const serverError = ref('')
const isEdit = computed(() => Boolean(props.user))
const showPassword = ref(false)

const roleOptions = computed(() => usersStore.roles.map((r) => ({ value: r.id, label: r.label })))
const selectedRole = computed(() => usersStore.roles.find((r) => r.id === values.roleId))

const { handleSubmit, isSubmitting, resetForm, setErrors, values, setFieldValue } = useForm({
  validationSchema: computed(() =>
    object({
      name: string().trim().required().max(80).label('الاسم'),
      email: string().trim().required().email().label('البريد الإلكتروني'),
      phone: string()
        .trim()
        .nullable()
        .matches(PHONE_PATTERN, { message: 'رقم الهاتف غير صالح', excludeEmptyString: true }),
      password: isEdit.value
        ? string()
            .nullable()
            .test('min', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', (v) => !v || v.length >= 8)
        : string().required().min(8).label('كلمة المرور'),
      roleId: number().typeError('اختر الدور').required().label('الدور'),
      isActive: boolean(),
    }),
  ),
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  serverError.value = ''
  showPassword.value = false
  await usersStore.fetchRoles().catch(() => {})
  const staff = usersStore.roles.find((r) => r.name === 'staff')
  resetForm({
    values: {
      name: props.user?.name ?? '',
      email: props.user?.email ?? '',
      phone: props.user?.phone ?? '',
      password: '',
      roleId: props.user?.role.id ?? staff?.id,
      isActive: props.user?.isActive ?? true,
    },
  })
})

const onSubmit = handleSubmit(async (form) => {
  serverError.value = ''
  const body = {
    name: form.name,
    email: form.email,
    phone: form.phone || undefined,
    roleId: form.roleId,
    isActive: form.isActive ?? true,
    ...(form.password ? { password: form.password } : {}),
  }
  try {
    if (isEdit.value) await usersStore.update(props.user!.id, body)
    else await usersStore.create(body)
    toast.success(
      isEdit.value ? 'تم حفظ المستخدم' : 'تم إنشاء الحساب — شارك بيانات الدخول مع صاحبه',
    )
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
    :title="isEdit ? 'تعديل المستخدم' : 'حساب جديد'"
    :persistent="isSubmitting"
  >
    <form
      id="user-form"
      class="flex flex-col gap-4"
      novalidate
      autocomplete="off"
      @submit="onSubmit"
    >
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
        />
      </FormField>
      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="email"
        label="البريد الإلكتروني (للدخول)"
        required
      >
        <AppInput
          :id="id"
          v-bind="field"
          type="email"
          dir="ltr"
          inputmode="email"
          autocomplete="off"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField v-slot="{ field, id, invalid, describedBy }" name="phone" label="رقم الهاتف">
        <AppInput
          :id="id"
          v-bind="field"
          type="tel"
          dir="ltr"
          inputmode="tel"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="password"
        :label="isEdit ? 'كلمة مرور جديدة' : 'كلمة المرور'"
        :hint="isEdit ? 'اتركها فارغة للإبقاء على كلمة المرور الحالية' : '8 أحرف على الأقل'"
        :required="!isEdit"
      >
        <AppInput
          :id="id"
          v-bind="field"
          :type="showPassword ? 'text' : 'password'"
          dir="ltr"
          autocomplete="new-password"
          :invalid="invalid"
          :aria-describedby="describedBy"
        >
          <template #end>
            <button
              type="button"
              class="grid size-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted"
              :aria-label="showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'"
              @click="showPassword = !showPassword"
            >
              <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
            </button>
          </template>
        </AppInput>
      </FormField>
      <FormField v-slot="{ field, id, invalid, describedBy }" name="roleId" label="الدور" required>
        <AppSelect
          :id="id"
          :model-value="asNumber(field.modelValue)"
          :options="roleOptions"
          :invalid="invalid"
          :aria-describedby="describedBy"
          @update:model-value="field['onUpdate:modelValue']($event)"
        />
      </FormField>
      <p v-if="selectedRole" class="-mt-2 rounded-xl bg-surface-muted p-3 text-sm text-fg-muted">
        {{
          selectedRole.name === 'admin'
            ? 'تحكم كامل: الحجوزات، الخدمات والأسعار، المستخدمون، الإعدادات.'
            : 'إدارة الحجوزات والزبائن وعرض الإحصائيات، دون تعديل الأسعار أو المستخدمين.'
        }}
      </p>
      <AppSwitch
        :model-value="values.isActive ?? true"
        label="الحساب مفعّل"
        description="الحساب الموقوف لا يستطيع الدخول ويُطرد فوراً"
        @update:model-value="setFieldValue('isActive', $event)"
      />
    </form>
    <template #footer>
      <AppButton variant="secondary" :disabled="isSubmitting" @click="open = false"
        >إلغاء</AppButton
      >
      <AppButton type="submit" form="user-form" :loading="isSubmitting" icon="check">حفظ</AppButton>
    </template>
  </AppModal>
</template>
