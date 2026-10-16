<script setup lang="ts">
import { useForm } from 'vee-validate'
import { object, string } from 'yup'

definePageMeta({ layout: 'auth', title: 'تسجيل الدخول' })

const route = useRoute()
const { login } = useAuth()
const serverError = ref('')
const showPassword = ref(false)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: object({
    email: string().trim().required().email().label('البريد الإلكتروني'),
    password: string().required().label('كلمة المرور'),
  }),
  initialValues: { email: '', password: '' },
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ''
  try {
    await login(values.email, values.password)
    const redirect = route.query.redirect
    const target =
      typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/'
    await navigateTo(target, { replace: true })
  } catch (error) {
    serverError.value = toApiError(error).message
  }
})
</script>

<template>
  <div class="rounded-3xl bg-surface p-6 shadow-float sm:p-8">
    <h1 class="text-xl font-extrabold">أهلاً بعودتك</h1>
    <p class="mt-1 text-[15px] text-fg-muted">سجّل الدخول لإدارة مواعيد الصالون</p>

    <div
      v-if="serverError"
      role="alert"
      class="mt-5 flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
    >
      <AppIcon name="alert" :size="18" class="mt-0.5" />
      {{ serverError }}
    </div>

    <form class="mt-6 flex flex-col gap-4" novalidate @submit="onSubmit">
      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="email"
        label="البريد الإلكتروني"
      >
        <AppInput
          :id="id"
          v-bind="field"
          type="email"
          dir="ltr"
          inputmode="email"
          autocomplete="username"
          placeholder="name@example.com"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <FormField v-slot="{ field, id, invalid, describedBy }" name="password" label="كلمة المرور">
        <AppInput
          :id="id"
          v-bind="field"
          :type="showPassword ? 'text' : 'password'"
          dir="ltr"
          autocomplete="current-password"
          :invalid="invalid"
          :aria-describedby="describedBy"
        >
          <template #end>
            <button
              type="button"
              class="grid size-10 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted"
              :aria-label="showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="18" />
            </button>
          </template>
        </AppInput>
      </FormField>

      <AppButton type="submit" size="lg" block :loading="isSubmitting" class="mt-2">
        تسجيل الدخول
      </AppButton>
    </form>

    <p class="mt-6 text-center text-sm text-fg-muted">
      لا تملك حساباً؟ الحسابات يُنشئها مدير الصالون فقط.
    </p>
  </div>
</template>
