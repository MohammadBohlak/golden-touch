<script setup lang="ts">
import { useForm } from 'vee-validate'
import { object, ref as yupRef, string } from 'yup'

definePageMeta({ title: 'حسابي' })

const { $api } = useNuxtApp()
const toast = useToast()
const { user, logout } = useAuth()
const { confirm } = useConfirm()

const { handleSubmit, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: object({
    currentPassword: string().required().label('كلمة المرور الحالية'),
    newPassword: string().required().min(8).label('كلمة المرور الجديدة'),
    confirmPassword: string()
      .required()
      .oneOf([yupRef('newPassword')], 'كلمتا المرور غير متطابقتين')
      .label('تأكيد كلمة المرور'),
  }),
  initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await $api('/auth/me/password', {
      method: 'PATCH',
      body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
    })
    resetForm()
    toast.success('تم تغيير كلمة المرور')
  } catch (error) {
    const apiError = toApiError(error)
    setErrors(fieldErrors(apiError))
    if (!apiError.errors) toast.error(apiError.message)
  }
})

async function onLogout() {
  if (await confirm({ title: 'تسجيل الخروج؟', confirmLabel: 'خروج' })) await logout()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="حسابي" back="/more" />

    <section
      v-if="user"
      class="flex items-center gap-4 rounded-3xl bg-ink-950 p-5 text-white shadow-card"
    >
      <span
        class="grid size-14 shrink-0 place-items-center rounded-full bg-gold-300 text-xl font-extrabold text-ink-950"
      >
        {{ initials(user.name) }}
      </span>
      <div class="min-w-0">
        <p class="truncate text-lg font-bold">{{ user.name }}</p>
        <p class="truncate text-sm text-ink-300" dir="ltr">{{ user.email }}</p>
        <AppBadge
          tone="dark"
          class="mt-1.5 bg-white/10"
          :icon="user.role.name === 'admin' ? 'crown' : 'user'"
          >{{ user.role.label }}</AppBadge
        >
      </div>
    </section>

    <section class="rounded-3xl bg-surface p-4 shadow-card">
      <h2 class="mb-4 flex items-center gap-2 font-bold">
        <AppIcon name="key" :size="18" /> تغيير كلمة المرور
      </h2>
      <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
        <FormField
          v-slot="{ field, id, invalid, describedBy }"
          name="currentPassword"
          label="كلمة المرور الحالية"
        >
          <AppInput
            :id="id"
            v-bind="field"
            type="password"
            dir="ltr"
            autocomplete="current-password"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>
        <FormField
          v-slot="{ field, id, invalid, describedBy }"
          name="newPassword"
          label="كلمة المرور الجديدة"
          hint="8 أحرف على الأقل"
        >
          <AppInput
            :id="id"
            v-bind="field"
            type="password"
            dir="ltr"
            autocomplete="new-password"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>
        <FormField
          v-slot="{ field, id, invalid, describedBy }"
          name="confirmPassword"
          label="تأكيد كلمة المرور الجديدة"
        >
          <AppInput
            :id="id"
            v-bind="field"
            type="password"
            dir="ltr"
            autocomplete="new-password"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>
        <AppButton type="submit" :loading="isSubmitting" icon="check" class="self-start"
          >حفظ كلمة المرور</AppButton
        >
      </form>
    </section>

    <AppButton variant="danger-soft" size="lg" icon="logout" block @click="onLogout"
      >تسجيل الخروج</AppButton
    >
  </div>
</template>
