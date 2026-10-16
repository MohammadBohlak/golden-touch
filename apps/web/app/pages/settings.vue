<script setup lang="ts">
import { useForm } from 'vee-validate'
import { array, number, object, string } from 'yup'

definePageMeta({ title: 'إعدادات الصالون', permission: 'settings.update' })

const settingsStore = useSettingsStore()
const toast = useToast()
const serverError = ref('')

const SLOT_OPTIONS = [
  { value: 5, label: 'كل 5 دقائق' },
  { value: 10, label: 'كل 10 دقائق' },
  { value: 15, label: 'كل ربع ساعة' },
  { value: 20, label: 'كل 20 دقيقة' },
  { value: 30, label: 'كل نصف ساعة' },
  { value: 60, label: 'كل ساعة' },
]
const TIMEZONES = [
  { value: 'Asia/Damascus', label: 'دمشق (Asia/Damascus)' },
  { value: 'Asia/Beirut', label: 'بيروت (Asia/Beirut)' },
  { value: 'Asia/Amman', label: 'عمّان (Asia/Amman)' },
  { value: 'Europe/Istanbul', label: 'إسطنبول (Europe/Istanbul)' },
  { value: 'Asia/Dubai', label: 'دبي (Asia/Dubai)' },
]
// ترتيب الأسبوع يبدأ بالسبت
const WEEK = [6, 0, 1, 2, 3, 4, 5]

const { handleSubmit, isSubmitting, resetForm, setErrors, values, setFieldValue, meta } = useForm({
  validationSchema: object({
    shopName: string().trim().required().max(60).label('اسم الصالون'),
    openTime: string().required().label('بداية الدوام'),
    closeTime: string()
      .required()
      .label('نهاية الدوام')
      .test('differs', 'يجب أن تختلف عن بداية الدوام', function (value) {
        return value !== this.parent.openTime
      }),
    slotMinutes: number().required(),
    timezone: string().required(),
    daysOff: array(number().required()).max(6, 'لا يمكن أن تكون كل الأيام عطلة'),
  }),
})

const { loading, errorMessage, refresh } = useApiState(() => settingsStore.ensure(true), {
  immediate: true,
  onSuccess: (s) =>
    resetForm({
      values: {
        shopName: s.shopName,
        openTime: s.openTime,
        closeTime: s.closeTime,
        slotMinutes: s.slotMinutes,
        timezone: s.timezone,
        daysOff: [...s.daysOff],
      },
    }),
})

const overnight = computed(() =>
  Boolean(values.openTime && values.closeTime && values.closeTime < values.openTime),
)
const timezoneOptions = computed(() =>
  TIMEZONES.some((t) => t.value === values.timezone) || !values.timezone
    ? TIMEZONES
    : [...TIMEZONES, { value: values.timezone, label: values.timezone }],
)

function toggleDay(day: number) {
  const current = values.daysOff ?? []
  setFieldValue(
    'daysOff',
    current.includes(day) ? current.filter((d: number) => d !== day) : [...current, day],
  )
}

const onSubmit = handleSubmit(async (form) => {
  serverError.value = ''
  try {
    const saved = await settingsStore.update({
      shopName: form.shopName,
      openTime: form.openTime,
      closeTime: form.closeTime,
      slotMinutes: form.slotMinutes,
      timezone: form.timezone,
      daysOff: form.daysOff ?? [],
    })
    resetForm({ values: { ...form, daysOff: [...saved.daysOff] } })
    invalidateApiCache()
    toast.success('تم حفظ إعدادات الصالون')
  } catch (error) {
    const apiError = toApiError(error)
    serverError.value = apiError.message
    setErrors(fieldErrors(apiError))
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PageHeader title="إعدادات الصالون" subtitle="ساعات الدوام تحدد الأوقات المعروضة في الجدول" />

    <LoadingState v-if="loading && !settingsStore.settings" variant="spinner" />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" @retry="refresh" />

    <form v-else class="flex flex-col gap-4" novalidate @submit="onSubmit">
      <p
        v-if="serverError"
        role="alert"
        class="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
      >
        {{ serverError }}
      </p>

      <section class="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
        <h2 class="flex items-center gap-2 font-bold">
          <AppIcon name="store" :size="18" /> الصالون
        </h2>
        <FormField
          v-slot="{ field, id, invalid, describedBy }"
          name="shopName"
          label="اسم الصالون"
          hint="يظهر في رسائل التذكير عبر واتساب"
        >
          <AppInput :id="id" v-bind="field" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </section>

      <section class="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
        <h2 class="flex items-center gap-2 font-bold">
          <AppIcon name="clock" :size="18" /> ساعات الدوام
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <FormField v-slot="{ field, id, invalid, describedBy }" name="openTime" label="من">
            <AppInput
              :id="id"
              v-bind="field"
              type="time"
              dir="ltr"
              :invalid="invalid"
              :aria-describedby="describedBy"
            />
          </FormField>
          <FormField v-slot="{ field, id, invalid, describedBy }" name="closeTime" label="إلى">
            <AppInput
              :id="id"
              v-bind="field"
              type="time"
              dir="ltr"
              :invalid="invalid"
              :aria-describedby="describedBy"
            />
          </FormField>
        </div>
        <p
          v-if="overnight"
          class="flex items-center gap-2 rounded-xl bg-info-soft p-3 text-sm font-semibold text-blue-900"
        >
          <AppIcon name="info" :size="16" />
          الدوام يمتد بعد منتصف الليل حتى {{ values.closeTime }} من اليوم التالي.
        </p>

        <FormField
          v-slot="{ field, id }"
          name="slotMinutes"
          label="دقة شبكة المواعيد"
          hint="الفاصل بين أوقات البدء المعروضة عند الحجز"
        >
          <AppSelect
            :id="id"
            :model-value="asNumber(field.modelValue)"
            :options="SLOT_OPTIONS"
            @update:model-value="field['onUpdate:modelValue'](Number($event))"
          />
        </FormField>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1.5 text-sm font-semibold">أيام العطلة الأسبوعية</legend>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
            <button
              v-for="day in WEEK"
              :key="day"
              type="button"
              :aria-pressed="values.daysOff?.includes(day) ?? false"
              :class="
                cn(
                  'h-11 rounded-xl border text-sm font-bold transition-colors',
                  values.daysOff?.includes(day)
                    ? 'border-red-300 bg-danger-soft text-red-800'
                    : 'border-line-strong hover:border-gold-500',
                )
              "
              @click="toggleDay(day)"
            >
              {{ WEEKDAY_NAMES[day] }}
            </button>
          </div>
          <p class="text-sm text-fg-muted">يبقى الحجز الاستثنائي ممكناً في أيام العطلة.</p>
        </fieldset>

        <FormField v-slot="{ field, id }" name="timezone" label="المنطقة الزمنية">
          <AppSelect
            :id="id"
            :model-value="field.modelValue == null ? '' : String(field.modelValue)"
            :options="timezoneOptions"
            @update:model-value="field['onUpdate:modelValue']($event)"
          />
        </FormField>
      </section>

      <div class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-4">
        <AppButton
          type="submit"
          size="lg"
          block
          icon="check"
          :loading="isSubmitting"
          :disabled="!meta.dirty"
        >
          حفظ الإعدادات
        </AppButton>
      </div>
    </form>
  </div>
</template>
