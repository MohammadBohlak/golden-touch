<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { array, number, object, string } from 'yup'
import type { CustomerRef, RecurringMutation, RecurringPreview, RecurringSeries } from '~/types/api'
import type { RecurringPrefill } from '~/utils/recurrence'

/**
 * نموذج الحجز الدوري (إنشاء/تعديل) بخطوات: ١ الزبون ← ٢ اليوم والتكرار والوقت ← ٣ الخدمات (ثابتة أو تناوب)،
 * مع معاينة حيّة للمواعيد قبل الحفظ. «اليوم» هو يوم الدوام الذي يعرضه جدول المواعيد (docs/RECURRING_BOOKINGS_PLAN.md).
 * لا حقل مالي: كل موعد يُحجز بسعر خدمته وقت التوليد.
 */
const props = withDefaults(
  defineProps<{
    series?: RecurringSeries | null
    initialCustomer?: CustomerRef | null
    /** تعبئة مسبقة عند «اجعله دورياً» من حجز قائم */
    prefill?: RecurringPrefill
  }>(),
  { series: null, initialCustomer: null, prefill: () => ({}) },
)
const emit = defineEmits<{ saved: [result: RecurringMutation] }>()

const { $api } = useNuxtApp()
const servicesStore = useServicesStore()
const settings = useSettingsStore()
const { timezone, today } = useShopTime()
const { can } = useAuth()

const original = props.series
const isEdit = Boolean(original)
const formError = ref('')

onMounted(() => {
  servicesStore.ensure().catch((e) => (formError.value = toApiError(e).message))
})

const { handleSubmit, isSubmitting, setErrors } = useForm({
  validationSchema: object({
    customerId: string().nullable(),
    customerName: string()
      .trim()
      .max(80)
      .when('customerId', {
        is: (value: string | null | undefined) => !value,
        then: (schema) => schema.required('اسم الزبون مطلوب'),
      }),
    customerPhone: string()
      .trim()
      .nullable()
      .matches(PHONE_PATTERN, { message: 'رقم الهاتف غير صالح', excludeEmptyString: true }),
    startDate: string().required('اختر تاريخ أول موعد'),
    startTime: string()
      .required('اختر وقت الموعد')
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/, 'وقت غير صالح'),
    intervalWeeks: number().required().oneOf([1, 2, 3, 4]),
    serviceIds: array()
      .of(string().defined())
      .test('filled', 'اختر الخدمة', (value) => Boolean(value?.length) && value!.every(Boolean)),
    endDate: string().nullable(),
    notes: string().trim().nullable().max(500),
  }),
  initialValues: {
    customerId: original?.customer.id ?? props.initialCustomer?.id ?? null,
    customerName: original?.customer.name ?? props.initialCustomer?.name ?? '',
    customerPhone: original?.customer.phone ?? props.initialCustomer?.phone ?? '',
    startDate: original?.startDate ?? props.prefill.date ?? addDays(today.value, 1),
    startTime: original?.startTime ?? props.prefill.time ?? '',
    intervalWeeks: original?.intervalWeeks ?? 1,
    serviceIds: original ? original.services.map((s) => s.id) : [props.prefill.serviceId ?? ''],
    endDate: original?.endDate ?? null,
    notes: original?.notes ?? '',
  },
})

const { value: customerId } = useField<string | null>('customerId')
const { value: startDate, errorMessage: dateError, meta: dateMeta } = useField<string>('startDate')
const { value: startTime } = useField<string>('startTime')
const { value: intervalWeeks } = useField<number>('intervalWeeks')
const {
  value: serviceIds,
  errorMessage: servicesError,
  meta: servicesMeta,
} = useField<string[]>('serviceIds')
const { value: endDate } = useField<string | null>('endDate')
const { value: notes } = useField<string>('notes')
const selectedCustomer = ref<CustomerRef | null>(
  original?.customer ?? props.initialCustomer ?? null,
)

// ── اليوم ──
const closedDays = computed(() => settings.settings?.daysOff ?? [])
/** ترتيب الأسبوع كما في الصالون: السبت أولاً */
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]
const weekday = computed(() => (startDate.value ? weekdayOf(startDate.value) : null))
const dateIsPast = computed(() => Boolean(startDate.value) && startDate.value < today.value)
const showDateError = computed(
  () => Boolean(dateError.value) && (dateMeta.touched || dateMeta.validated),
)

function pickWeekday(day: number) {
  if (day !== weekday.value) startDate.value = nextWeekdayDate(today.value, day)
}

// ── الخدمات ──
const serviceOptions = computed(() =>
  servicesStore.items
    .filter((s) => s.isActive || serviceIds.value.includes(s.id))
    .map((s) => ({ value: s.id, label: `${s.name} · ${formatDuration(s.durationMinutes)}` })),
)
const selectedNames = computed(() =>
  serviceIds.value.flatMap((id) => {
    const found = servicesStore.byId(id)
    return found ? [found.name] : []
  }),
)
const caption = computed(() => rotationCaption(selectedNames.value))
const showServicesError = computed(
  () => Boolean(servicesError.value) && (servicesMeta.touched || servicesMeta.validated),
)

function setService(index: number, id: unknown) {
  serviceIds.value = serviceIds.value.map((current, i) =>
    i === index ? String(id ?? '') : current,
  )
}
const addService = () => (serviceIds.value = [...serviceIds.value, ''])
const removeService = (index: number) =>
  (serviceIds.value = serviceIds.value.filter((_, i) => i !== index))
const moveService = (index: number, delta: -1 | 1) =>
  (serviceIds.value = moveItem(serviceIds.value, index, delta))

// ── المعاينة الحيّة ──
const values = computed(() => ({
  startDate: startDate.value ?? '',
  startTime: startTime.value ?? '',
  intervalWeeks: Number(intervalWeeks.value) || 1,
  serviceIds: serviceIds.value ?? [],
  endDate: endDate.value || null,
  notes: notes.value ?? '',
}))
const previewable = computed(() => canPreview(values.value))
const previewKey = computed(() =>
  previewable.value ? JSON.stringify(previewBody(values.value, original ?? undefined)) : '',
)
const debouncedKey = useDebounced(previewKey, 400)

const {
  data: preview,
  loading: previewLoading,
  errorMessage: previewError,
  execute: runPreview,
  abort: abortPreview,
} = useApiState((signal, body: Record<string, unknown>) =>
  $api<RecurringPreview>('/recurring-bookings/preview', { method: 'POST', body, signal }),
)
watch(
  debouncedKey,
  (key) => {
    if (key) void runPreview(JSON.parse(key))
    else abortPreview()
  },
  { immediate: true },
)

// ── خيارات إضافية ──
const extrasOpen = ref(Boolean(original?.endDate || original?.notes))

function scrollToFirstError() {
  nextTick(() =>
    document.querySelector('[aria-invalid="true"], [data-error]')?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    }),
  )
}

// ── الإرسال ──
const onSubmit = handleSubmit(async (form) => {
  formError.value = ''
  try {
    let id = form.customerId
    if (!id) {
      // زبون جديد: يُنشأ أولاً ويُحفظ معرّفه كي لا يتكرر عند إعادة المحاولة بعد خطأ لاحق
      const created = await $api<CustomerRef>('/customers', {
        method: 'POST',
        body: { name: form.customerName, phone: form.customerPhone || undefined },
      })
      id = created.id
      customerId.value = id
      selectedCustomer.value = created
    }
    const result = original
      ? await $api<RecurringMutation>(`/recurring-bookings/${original.id}`, {
          method: 'PATCH',
          body: patchBody(original, values.value, id),
        })
      : await $api<RecurringMutation>('/recurring-bookings', {
          method: 'POST',
          body: createBody(values.value, id),
        })
    emit('saved', result)
  } catch (error) {
    const apiError = toApiError(error)
    formError.value = apiError.message
    setErrors(fieldErrors(apiError))
    scrollToFirstError()
  }
}, scrollToFirstError)

const summary = computed(() => {
  if (!startTime.value) return ''
  const parts = [
    describeRecurrence(weekday.value ?? 0, Number(intervalWeeks.value) || 1),
    formatClockTime(startTime.value),
  ]
  return parts.join(' · ')
})
</script>

<template>
  <form class="flex flex-col gap-6" novalidate @submit="onSubmit">
    <ExpandTransition>
      <div
        v-if="formError"
        role="alert"
        data-error
        class="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
      >
        <AppIcon name="alert" :size="18" class="mt-0.5 shrink-0" />
        {{ formError }}
      </div>
    </ExpandTransition>

    <!-- ١ الزبون -->
    <section aria-labelledby="step-customer" class="flex flex-col gap-3">
      <h2 id="step-customer" class="flex items-center gap-2 text-lg font-extrabold">
        <span class="grid size-7 place-items-center rounded-full bg-ink-950 text-sm text-gold-300"
          >١</span
        >
        الزبون
      </h2>
      <CustomerPicker v-model:customer-id="customerId" v-model:selected="selectedCustomer" />
    </section>

    <!-- ٢ اليوم والتكرار والوقت -->
    <section aria-labelledby="step-time" class="flex flex-col gap-3">
      <h2 id="step-time" class="flex items-center gap-2 text-lg font-extrabold">
        <span class="grid size-7 place-items-center rounded-full bg-ink-950 text-sm text-gold-300"
          >٢</span
        >
        اليوم والتكرار والوقت
      </h2>

      <div
        class="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label="يوم الأسبوع"
      >
        <button
          v-for="day in WEEK_ORDER"
          :key="day"
          type="button"
          :aria-pressed="weekday === day"
          :disabled="closedDays.includes(day)"
          :class="
            cn(
              'flex h-14 min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-2xl border px-3 transition-colors',
              weekday === day
                ? 'border-ink-950 bg-ink-950 text-white'
                : 'border-line-strong bg-surface hover:border-gold-500',
              closedDays.includes(day) &&
                'cursor-not-allowed border-dashed bg-surface text-fg-muted hover:border-line-strong',
            )
          "
          @click="pickWeekday(day)"
        >
          <span class="text-sm font-bold">{{ WEEKDAY_NAMES[day] }}</span>
          <span v-if="closedDays.includes(day)" class="text-[13px]">عطلة</span>
        </button>
      </div>

      <label
        :class="
          cn(
            'relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border bg-surface px-4',
            showDateError ? 'border-danger' : 'border-line-strong',
          )
        "
      >
        <AppIcon name="calendar" :size="20" class="shrink-0 text-fg-muted" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm text-fg-muted">{{ dateIsPast ? 'بدأت في' : 'أول موعد' }}</span>
          <span class="block font-bold">{{
            startDate ? formatDateLong(startDate, true) : '—'
          }}</span>
        </span>
        <span class="text-sm font-semibold text-brand-ink">تغيير</span>
        <input
          v-model="startDate"
          type="date"
          :min="isEdit ? undefined : today"
          class="absolute inset-0 cursor-pointer opacity-0"
          aria-label="تاريخ أول موعد"
        />
      </label>
      <ExpandTransition>
        <p v-if="showDateError" role="alert" data-error class="text-sm font-medium text-danger">
          {{ dateError }}
        </p>
      </ExpandTransition>

      <SegmentedControl v-model="intervalWeeks" :options="INTERVAL_OPTIONS" label="تكرار الموعد" />
      <ExpandTransition>
        <p v-if="Number(intervalWeeks) > 1" class="text-sm text-fg-muted">
          الأسبوع الذي يقع فيه تاريخ أول موعد هو الأول، ثم يتكرر كل
          {{ intervalWeeks }} أسابيع.
        </p>
      </ExpandTransition>

      <FormField v-slot="{ field, id, invalid, describedBy }" name="startTime" label="الوقت">
        <AppInput
          :id="id"
          :model-value="field.modelValue == null ? '' : String(field.modelValue)"
          type="time"
          step="900"
          dir="ltr"
          :invalid="invalid"
          :aria-describedby="describedBy"
          @update:model-value="field['onUpdate:modelValue']($event)"
          @blur="field.onBlur"
        />
      </FormField>
    </section>

    <!-- ٣ الخدمات -->
    <section aria-labelledby="step-services" class="flex flex-col gap-3">
      <h2 id="step-services" class="flex items-center gap-2 text-lg font-extrabold">
        <span class="grid size-7 place-items-center rounded-full bg-ink-950 text-sm text-gold-300"
          >٣</span
        >
        الخدمة
      </h2>

      <FadeTransition>
        <LoadingState v-if="!servicesStore.loaded" key="loading" variant="spinner" />
        <EmptyState
          v-else-if="!serviceOptions.length"
          key="empty"
          icon="scissors"
          title="لا توجد خدمات فعّالة"
        >
          <AppButton v-if="can('services.update')" to="/services" variant="secondary" size="sm"
            >إدارة الخدمات</AppButton
          >
        </EmptyState>
        <div v-else key="rows" class="flex flex-col gap-2.5">
          <ol class="flex flex-col gap-2.5">
            <li v-for="(id, i) in serviceIds" :key="i" class="flex items-center gap-2">
              <span
                v-if="serviceIds.length > 1"
                class="grid size-7 shrink-0 place-items-center rounded-full bg-ink-950 text-sm font-bold text-gold-300 tabular-nums"
                aria-hidden="true"
                >{{ i + 1 }}</span
              >
              <AppSelect
                class="min-w-0 flex-1"
                :model-value="id || null"
                :options="serviceOptions"
                placeholder="اختر الخدمة"
                :aria-label="serviceIds.length > 1 ? `الخدمة رقم ${i + 1}` : 'الخدمة'"
                :invalid="showServicesError && !id"
                @update:model-value="setService(i, $event)"
              />
              <template v-if="serviceIds.length > 1">
                <AppButton
                  variant="ghost"
                  size="icon"
                  icon="chevron-up"
                  :disabled="i === 0"
                  :aria-label="`تقديم الخدمة رقم ${i + 1}`"
                  @click="moveService(i, -1)"
                />
                <AppButton
                  variant="ghost"
                  size="icon"
                  icon="chevron-down"
                  :disabled="i === serviceIds.length - 1"
                  :aria-label="`تأخير الخدمة رقم ${i + 1}`"
                  @click="moveService(i, 1)"
                />
                <AppButton
                  variant="danger-soft"
                  size="icon"
                  icon="x"
                  :aria-label="`حذف الخدمة رقم ${i + 1}`"
                  @click="removeService(i)"
                />
              </template>
            </li>
          </ol>

          <ExpandTransition>
            <p v-if="caption" class="text-sm font-semibold text-fg-muted">
              <AppIcon name="repeat" :size="14" class="-mt-0.5 inline" /> {{ caption }}
            </p>
          </ExpandTransition>

          <AppButton
            v-if="serviceIds.length < MAX_ROTATION"
            variant="secondary"
            size="sm"
            icon="plus"
            class="self-start"
            @click="addService"
          >
            {{ serviceIds.length > 1 ? 'إضافة خدمة أخرى للتناوب' : 'تناوب مع خدمة أخرى' }}
          </AppButton>
        </div>
      </FadeTransition>
      <ExpandTransition>
        <p v-if="showServicesError" role="alert" data-error class="text-sm font-medium text-danger">
          {{ servicesError }}
        </p>
      </ExpandTransition>
    </section>

    <RecurringPreviewPanel
      :preview="preview"
      :waiting="!previewable"
      :loading="previewLoading"
      :error-message="previewError"
      :editing="isEdit"
      :timezone="timezone"
      :today="today"
    />

    <Disclosure v-model:open="extrasOpen">
      <template #summary>
        <AppIcon name="note" :size="18" />
        <span class="font-bold">تاريخ الانتهاء وملاحظات</span>
      </template>
      <div class="flex flex-col gap-4 pt-1">
        <div class="flex flex-col gap-1.5">
          <label for="recurring-end" class="text-sm font-semibold">ينتهي في (اختياري)</label>
          <div class="flex items-center gap-2">
            <AppInput
              id="recurring-end"
              :model-value="endDate ?? ''"
              type="date"
              :min="startDate || undefined"
              class="min-w-0 flex-1"
              @update:model-value="endDate = $event ? String($event) : null"
            />
            <AppButton v-if="endDate" variant="ghost" size="sm" @click="endDate = null"
              >إزالة</AppButton
            >
          </div>
        </div>
        <FormField v-slot="{ field, id, invalid, describedBy }" name="notes" label="ملاحظات">
          <AppTextarea
            :id="id"
            :model-value="field.modelValue == null ? '' : String(field.modelValue)"
            maxlength="500"
            placeholder="تُنسخ إلى كل موعد"
            :invalid="invalid"
            :aria-describedby="describedBy"
            @update:model-value="field['onUpdate:modelValue']($event)"
            @blur="field.onBlur"
          />
        </FormField>
      </div>
    </Disclosure>

    <!-- شريط الملخص والتثبيت -->
    <div
      class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-1 flex items-center gap-3 rounded-2xl bg-ink-950 p-3 text-white shadow-float lg:bottom-4"
    >
      <div class="min-w-0 flex-1">
        <Transition name="fade" mode="out-in">
          <p :key="summary" class="truncate text-sm font-semibold text-ink-200">
            {{ summary || 'اختر اليوم والوقت' }}
          </p>
        </Transition>
      </div>
      <AppButton type="submit" variant="gold" size="lg" icon="check" :loading="isSubmitting">
        {{ isEdit ? 'حفظ التعديل' : 'تثبيت الحجز الدوري' }}
      </AppButton>
    </div>
  </form>
</template>
