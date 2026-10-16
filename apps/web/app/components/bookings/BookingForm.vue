<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { number, object, string } from 'yup'
import type { Booking, CustomerRef } from '~/types/api'

/**
 * نموذج الحجز (إنشاء/تعديل) بخطوات واضحة في صفحة واحدة:
 * ١ الخدمة ← ٢ اليوم والوقت (الأوقات المتاحة فقط قابلة للاختيار) ← ٣ الزبون ← تفاصيل اختيارية.
 * شريط ملخص ثابت أسفل الشاشة مع زر التثبيت.
 */
const props = withDefaults(
  defineProps<{
    booking?: Booking | null
    initialDate?: string
    initialStart?: string | null
    initialCustomer?: CustomerRef | null
  }>(),
  { booking: null, initialDate: undefined, initialStart: null, initialCustomer: null },
)
const emit = defineEmits<{ saved: [booking: Booking] }>()

const { $api } = useNuxtApp()
const servicesStore = useServicesStore()
const { timezone, today } = useShopTime()
const { isAdmin } = useAuth()

const isEdit = computed(() => Boolean(props.booking))
const formError = ref('')
const slotPicker = ref<{ refresh: () => void }>()

onMounted(() => {
  servicesStore.ensure().catch((e) => (formError.value = toApiError(e).message))
})

// ── القيم الابتدائية ──
const b = props.booking
const bookingService = b ? servicesStore.byId(b.serviceId) : undefined
const date = ref(
  b
    ? dateInTz(b.startAt, timezone.value)
    : props.initialStart
      ? dateInTz(props.initialStart, timezone.value)
      : (props.initialDate ?? today.value),
)

const { handleSubmit, isSubmitting, setErrors } = useForm({
  validationSchema: object({
    serviceId: string().required('اختر الخدمة'),
    startAt: string().nullable().required('اختر وقت الموعد'),
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
    notes: string().trim().nullable().max(500),
    durationMinutes: number().nullable().integer().min(5).max(480).label('المدة'),
    price: number().nullable().integer().min(0).label('السعر'),
  }),
  initialValues: {
    serviceId: b?.serviceId ?? '',
    startAt: b?.startAt ?? props.initialStart ?? null,
    customerId: b?.customer.id ?? props.initialCustomer?.id ?? null,
    customerName: b?.customer.name ?? props.initialCustomer?.name ?? '',
    customerPhone: b?.customer.phone ?? props.initialCustomer?.phone ?? '',
    notes: b?.notes ?? '',
    durationMinutes:
      b && bookingService && b.durationMinutes !== bookingService.durationMinutes
        ? b.durationMinutes
        : null,
    price: b && bookingService && b.price !== bookingService.price ? b.price : null,
  },
})

const {
  value: serviceId,
  errorMessage: serviceError,
  meta: serviceMeta,
} = useField<string>('serviceId')
const {
  value: startAt,
  errorMessage: startError,
  meta: startMeta,
} = useField<string | null>('startAt')
const { value: customerId } = useField<string | null>('customerId')
const { value: customDuration } = useField<number | null>('durationMinutes')
const { value: customPrice } = useField<number | null>('price')
const selectedCustomer = ref<CustomerRef | null>(b?.customer ?? props.initialCustomer ?? null)

const service = computed(() => (serviceId.value ? servicesStore.byId(serviceId.value) : undefined))
const duration = computed(() => customDuration.value || service.value?.durationMinutes || null)
const price = computed(() => customPrice.value ?? service.value?.price ?? 0)

// الخدمات المعروضة: الفعّالة + خدمة الحجز الحالية حتى لو عُطّلت
const services = computed(() =>
  servicesStore.items.filter((s) => s.isActive || s.id === b?.serviceId),
)

const quickDays = computed(() =>
  [0, 1, 2].map((offset) => {
    const value = addDays(today.value, offset)
    return { value, label: relativeDayLabel(value, today.value), sub: formatDateShort(value) }
  }),
)

watch(date, (value) => {
  if (startAt.value && dateInTz(startAt.value, timezone.value) !== value) startAt.value = null
})

const summary = computed(() => {
  const parts: string[] = []
  if (service.value) parts.push(service.value.name)
  if (startAt.value)
    parts.push(
      `${relativeDayLabel(date.value, today.value)} ${formatTime(startAt.value, timezone.value)}`,
    )
  return parts.join(' · ')
})

const showServiceError = computed(
  () => Boolean(serviceError.value) && (serviceMeta.touched || serviceMeta.validated),
)
const showStartError = computed(
  () => Boolean(startError.value) && (startMeta.touched || startMeta.validated),
)

function scrollToFirstError() {
  nextTick(() =>
    document
      .querySelector('[aria-invalid="true"], [data-error]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  )
}

const onSubmit = handleSubmit(async (values) => {
  formError.value = ''
  const body: Record<string, unknown> = {
    serviceId: values.serviceId,
    startAt: values.startAt,
    notes: values.notes || (isEdit.value ? '' : undefined),
  }
  if (values.customerId) body.customerId = values.customerId
  else {
    body.customerName = values.customerName
    body.customerPhone = values.customerPhone || undefined
  }
  if (values.durationMinutes) body.durationMinutes = values.durationMinutes
  if (values.price != null) body.price = values.price

  try {
    const saved = isEdit.value
      ? await $api<Booking>(`/bookings/${b!.id}`, { method: 'PATCH', body })
      : await $api<Booking>('/bookings', { method: 'POST', body })
    emit('saved', saved)
  } catch (error) {
    const apiError = toApiError(error)
    formError.value = apiError.message
    setErrors(fieldErrors(apiError))
    if (apiError.status === 409) slotPicker.value?.refresh()
    scrollToFirstError()
  }
}, scrollToFirstError)
</script>

<template>
  <form class="flex flex-col gap-6" novalidate @submit="onSubmit">
    <div
      v-if="formError"
      role="alert"
      data-error
      class="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
    >
      <AppIcon name="alert" :size="18" class="mt-0.5" />
      {{ formError }}
    </div>

    <!-- ١ الخدمة -->
    <section aria-labelledby="step-service" class="flex flex-col gap-3">
      <h2 id="step-service" class="flex items-center gap-2 text-lg font-extrabold">
        <span class="grid size-7 place-items-center rounded-full bg-ink-950 text-sm text-gold-300"
          >١</span
        >
        الخدمة
      </h2>
      <LoadingState v-if="!servicesStore.loaded" variant="cards" :rows="4" />
      <EmptyState
        v-else-if="!services.length"
        icon="scissors"
        title="لا توجد خدمات فعّالة"
        description="أضف خدمات الحلاقة وأسعارها أولاً."
      >
        <AppButton v-if="isAdmin" to="/services" variant="secondary" size="sm"
          >إدارة الخدمات</AppButton
        >
      </EmptyState>
      <ServicePicker
        v-else
        v-model="serviceId"
        :services="services"
        :invalid="showServiceError"
        described-by="service-error"
      />
      <p
        v-if="showServiceError"
        id="service-error"
        role="alert"
        data-error
        class="text-sm font-medium text-danger"
      >
        {{ serviceError }}
      </p>
    </section>

    <!-- ٢ اليوم والوقت -->
    <section aria-labelledby="step-time" class="flex flex-col gap-3">
      <h2 id="step-time" class="flex items-center gap-2 text-lg font-extrabold">
        <span class="grid size-7 place-items-center rounded-full bg-ink-950 text-sm text-gold-300"
          >٢</span
        >
        اليوم والوقت
      </h2>
      <div class="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          v-for="d in quickDays"
          :key="d.value"
          type="button"
          :aria-pressed="date === d.value"
          :class="
            cn(
              'flex h-14 min-w-24 shrink-0 flex-col items-center justify-center rounded-2xl border px-3 transition-colors',
              date === d.value
                ? 'border-ink-950 bg-ink-950 text-white'
                : 'border-line-strong bg-surface hover:border-gold-500',
            )
          "
          @click="date = d.value"
        >
          <span class="text-sm font-bold">{{ d.label }}</span>
          <span :class="cn('text-xs', date === d.value ? 'text-gold-300' : 'text-fg-muted')">{{
            d.sub
          }}</span>
        </button>
        <label
          :class="
            cn(
              'relative flex h-14 min-w-32 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border px-3',
              !quickDays.some((d) => d.value === date)
                ? 'border-ink-950 bg-ink-950 text-white'
                : 'border-line-strong bg-surface',
            )
          "
        >
          <span class="flex items-center gap-1.5 text-sm font-bold">
            <AppIcon name="calendar" :size="16" />
            تاريخ آخر
          </span>
          <span v-if="!quickDays.some((d) => d.value === date)" class="text-xs text-gold-300">
            {{ formatDateShort(date) }}
          </span>
          <input
            v-model="date"
            type="date"
            :min="isEdit ? undefined : today"
            class="absolute inset-0 cursor-pointer opacity-0"
            aria-label="اختيار تاريخ الموعد"
          />
        </label>
      </div>
      <p class="text-sm font-semibold text-fg-muted">{{ formatDateLong(date, true) }}</p>

      <SlotPicker
        ref="slotPicker"
        v-model="startAt"
        :date="date"
        :duration-minutes="duration"
        :exclude-id="booking?.id"
        :timezone="timezone"
        :invalid="showStartError"
        @next-day="date = addDays(date, 1)"
      />
      <p v-if="showStartError" role="alert" data-error class="text-sm font-medium text-danger">
        {{ startError }}
      </p>
    </section>

    <!-- ٣ الزبون -->
    <section aria-labelledby="step-customer" class="flex flex-col gap-3">
      <h2 id="step-customer" class="flex items-center gap-2 text-lg font-extrabold">
        <span class="grid size-7 place-items-center rounded-full bg-ink-950 text-sm text-gold-300"
          >٣</span
        >
        الزبون
      </h2>
      <CustomerPicker v-model:customer-id="customerId" v-model:selected="selectedCustomer" />
    </section>

    <!-- تفاصيل اختيارية -->
    <details
      class="group rounded-2xl border border-line bg-surface"
      :open="customDuration != null || customPrice != null || undefined"
    >
      <summary class="flex h-13 list-none items-center justify-between px-4 font-bold">
        <span class="flex items-center gap-2">
          <AppIcon name="note" :size="18" />
          ملاحظات وسعر أو مدة مخصصة
        </span>
        <AppIcon
          name="chevron-down"
          :size="18"
          class="transition-transform group-open:rotate-180"
        />
      </summary>
      <div class="flex flex-col gap-4 px-4 pb-4">
        <div class="grid grid-cols-2 gap-3">
          <FormField
            v-slot="{ field, id, invalid, describedBy }"
            name="durationMinutes"
            label="مدة مخصصة (دقيقة)"
            :hint="service ? `الافتراضي ${service.durationMinutes}` : undefined"
          >
            <AppInput
              :id="id"
              :model-value="asNumber(field.modelValue)"
              type="number"
              inputmode="numeric"
              min="5"
              max="480"
              step="5"
              dir="ltr"
              :placeholder="service ? String(service.durationMinutes) : '—'"
              :invalid="invalid"
              :aria-describedby="describedBy"
              @update:model-value="field['onUpdate:modelValue'](parseInteger($event))"
              @blur="field.onBlur"
            />
          </FormField>
          <FormField
            v-slot="{ field, id, invalid, describedBy }"
            name="price"
            label="سعر متفق عليه"
            :hint="service ? `الافتراضي ${formatMoney(service.price)}` : undefined"
          >
            <AppMoneyInput
              :id="id"
              :model-value="asNumber(field.modelValue)"
              :invalid="invalid"
              :aria-describedby="describedBy"
              :placeholder="service ? String(service.price) : ''"
              @update:model-value="field['onUpdate:modelValue']($event)"
              @blur="field.onBlur"
            />
          </FormField>
        </div>
        <FormField v-slot="{ field, id, invalid, describedBy }" name="notes" label="ملاحظات">
          <AppTextarea
            :id="id"
            :model-value="field.modelValue == null ? '' : String(field.modelValue)"
            maxlength="500"
            placeholder="مثلاً: يفضّل قصّة قصيرة من الجانبين"
            :invalid="invalid"
            :aria-describedby="describedBy"
            @update:model-value="field['onUpdate:modelValue']($event)"
            @blur="field.onBlur"
          />
        </FormField>
      </div>
    </details>

    <!-- شريط الملخص والتثبيت -->
    <div
      class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-1 flex items-center gap-3 rounded-2xl bg-ink-950 p-3 text-white shadow-float lg:bottom-4"
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-ink-200">
          {{ summary || 'اختر الخدمة والوقت' }}
        </p>
        <p class="text-lg font-extrabold text-gold-300 tabular-nums">{{ formatMoney(price) }}</p>
      </div>
      <AppButton type="submit" variant="gold" size="lg" icon="check" :loading="isSubmitting">
        {{ isEdit ? 'حفظ التعديل' : 'تثبيت الحجز' }}
      </AppButton>
    </div>
  </form>
</template>
