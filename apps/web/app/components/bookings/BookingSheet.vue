<script setup lang="ts">
import type { Booking } from '~/types/api'

/**
 * ورقة تفاصيل الحجز مع كل الإجراءات في مكان واحد:
 * إكمال وتسجيل المبلغ المدفوع (افتراضياً سعر الخدمة)، إلغاء بسبب سريع، تعديل، اتصال، تذكير واتساب.
 */
const props = defineProps<{ booking: Booking | null; timezone: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [booking: Booking]; deleted: [id: string] }>()

const { $api } = useNuxtApp()
const toast = useToast()
const { confirm } = useConfirm()
const { can } = useAuth()
const settings = useSettingsStore()

type Mode = 'details' | 'complete' | 'cancel' | 'editPaid'
const mode = ref<Mode>('details')
const paid = ref<number | null>(null)
const reason = ref('')
const busy = ref(false)
const error = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    mode.value = 'details'
    error.value = ''
    reason.value = ''
  }
})

const b = computed(() => props.booking)
const dateLabel = computed(() =>
  b.value ? formatDateLong(dateInTz(b.value.startAt, props.timezone)) : '',
)
const timeLabel = computed(() =>
  b.value ? formatTimeRange(b.value.startAt, b.value.endAt, props.timezone) : '',
)

const whatsapp = computed(() => {
  if (!b.value?.customer.phone) return null
  const shop = settings.settings?.shopName ?? 'Golden Touch'
  const text = `مرحباً ${b.value.customer.name}، نذكّرك بموعدك في صالون ${shop} يوم ${dateLabel.value} الساعة ${formatTime(b.value.startAt, props.timezone)} (${b.value.serviceName}). بانتظارك!`
  return whatsappLink(b.value.customer.phone, text)
})

function startComplete() {
  paid.value = b.value?.price ?? 0
  error.value = ''
  mode.value = 'complete'
}

function startEditPaid() {
  paid.value = b.value?.paidAmount ?? b.value?.price ?? 0
  error.value = ''
  mode.value = 'editPaid'
}

async function run(
  action: () => Promise<Booking>,
  success: string,
  options?: { undo?: () => Promise<Booking> },
) {
  busy.value = true
  error.value = ''
  try {
    const updated = await action()
    emit('changed', updated)
    open.value = false
    toast.success(
      success,
      options?.undo
        ? {
            action: {
              label: 'تراجع',
              handler: async () => {
                try {
                  emit('changed', await options.undo!())
                  toast.info('تم التراجع')
                } catch (e) {
                  toast.error(toApiError(e).message)
                }
              },
            },
          }
        : undefined,
    )
  } catch (e) {
    error.value = toApiError(e).message
  } finally {
    busy.value = false
  }
}

const reopen = (id: string) => $api<Booking>(`/bookings/${id}/reopen`, { method: 'POST' })

function submitComplete() {
  if (!b.value) return
  if (paid.value == null || paid.value < 0) {
    error.value = 'أدخل المبلغ المدفوع'
    return
  }
  const id = b.value.id
  void run(
    () =>
      $api<Booking>(`/bookings/${id}/complete`, {
        method: 'POST',
        body: { paidAmount: paid.value },
      }),
    `اكتمل الحجز وسُجّل ${formatMoney(paid.value)}`,
    { undo: () => reopen(id) },
  )
}

function submitPaid() {
  if (!b.value || paid.value == null) return
  const id = b.value.id
  void run(
    () => $api<Booking>(`/bookings/${id}`, { method: 'PATCH', body: { paidAmount: paid.value } }),
    'تم تعديل المبلغ المدفوع',
  )
}

function submitCancel() {
  if (!b.value) return
  const id = b.value.id
  void run(
    () =>
      $api<Booking>(`/bookings/${id}/cancel`, {
        method: 'POST',
        body: { reason: reason.value || undefined },
      }),
    'أُلغي الحجز وأصبح وقته متاحاً',
    { undo: () => reopen(id) },
  )
}

async function submitReopen() {
  if (!b.value) return
  const ok = await confirm({
    title: 'إعادة الحجز إلى "قيد العمل"؟',
    message:
      b.value.status === 'COMPLETED'
        ? 'سيُحذف المبلغ المدفوع المسجّل لهذا الحجز.'
        : 'سيُحجز وقته من جديد إن كان ما زال متاحاً.',
    confirmLabel: 'إعادة فتح',
  })
  if (ok) void run(() => reopen(b.value!.id), 'عاد الحجز إلى قيد العمل')
}

async function remove() {
  if (!b.value) return
  const ok = await confirm({
    title: 'حذف الحجز نهائياً؟',
    message:
      'لا يمكن التراجع عن الحذف وسيختفي من السجل والإحصائيات. للإلغاء العادي استخدم "إلغاء الحجز".',
    confirmLabel: 'حذف نهائي',
    tone: 'danger',
  })
  if (!ok) return
  busy.value = true
  try {
    await $api(`/bookings/${b.value.id}`, { method: 'DELETE' })
    emit('deleted', b.value.id)
    open.value = false
    toast.success('تم حذف الحجز')
  } catch (e) {
    error.value = toApiError(e).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal v-model:open="open" :persistent="busy">
    <template #header>
      <div v-if="b" class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-extrabold">{{ b.customer.name }}</h2>
          <StatusBadge :status="b.status" />
        </div>
        <p class="text-sm text-fg-muted">{{ dateLabel }} · {{ timeLabel }}</p>
      </div>
    </template>

    <div v-if="b" class="flex flex-col gap-4">
      <div
        v-if="error"
        role="alert"
        class="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
      >
        <AppIcon name="alert" :size="18" class="mt-0.5" />
        {{ error }}
      </div>

      <!-- التفاصيل -->
      <template v-if="mode === 'details'">
        <dl class="grid grid-cols-2 gap-3">
          <div class="col-span-2 flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
            <span class="grid size-11 place-items-center rounded-xl bg-ink-950 text-gold-300">
              <AppIcon name="scissors" />
            </span>
            <div class="min-w-0">
              <dt class="sr-only">الخدمة</dt>
              <dd class="font-bold">{{ b.serviceName }}</dd>
              <dd class="text-sm text-fg-muted">{{ formatDuration(b.durationMinutes) }}</dd>
            </div>
          </div>
          <div class="rounded-2xl border border-line p-3">
            <dt class="text-xs font-semibold text-fg-muted">السعر المتفق عليه</dt>
            <dd class="mt-0.5 font-bold tabular-nums">{{ formatMoney(b.price) }}</dd>
          </div>
          <div class="rounded-2xl border border-line p-3">
            <dt class="text-xs font-semibold text-fg-muted">المدفوع</dt>
            <dd
              :class="
                cn(
                  'mt-0.5 font-bold tabular-nums',
                  b.paidAmount != null ? 'text-success' : 'text-fg-subtle',
                )
              "
            >
              {{ b.paidAmount != null ? formatMoney(b.paidAmount) : '—' }}
            </dd>
          </div>
          <div
            v-if="b.customer.phone"
            class="col-span-2 flex items-center justify-between gap-2 rounded-2xl border border-line p-3"
          >
            <div>
              <dt class="text-xs font-semibold text-fg-muted">الهاتف</dt>
              <dd class="font-bold tabular-nums" dir="ltr">{{ b.customer.phone }}</dd>
            </div>
            <div class="flex gap-2">
              <AppButton
                :href="`tel:${b.customer.phone}`"
                variant="secondary"
                size="icon"
                icon="phone"
                aria-label="اتصال"
              />
              <AppButton
                v-if="whatsapp && b.status === 'ACTIVE'"
                :href="whatsapp"
                target="_blank"
                rel="noopener"
                variant="secondary"
                size="icon"
                icon="message"
                aria-label="إرسال تذكير عبر واتساب"
                class="text-green-700"
              />
            </div>
          </div>
          <div v-if="b.notes" class="col-span-2 rounded-2xl bg-gold-50 p-3">
            <dt class="text-xs font-semibold text-gold-800">ملاحظات</dt>
            <dd class="mt-0.5 text-[15px] whitespace-pre-line">{{ b.notes }}</dd>
          </div>
          <div v-if="b.cancelReason" class="col-span-2 rounded-2xl bg-danger-soft p-3">
            <dt class="text-xs font-semibold text-red-800">سبب الإلغاء</dt>
            <dd class="mt-0.5">{{ b.cancelReason }}</dd>
          </div>
        </dl>
        <p class="text-xs text-fg-subtle">
          سجّله {{ b.createdBy?.name ?? '—' }} ·
          <NuxtLink
            :to="`/customers/${b.customer.id}`"
            class="font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            ملف الزبون
          </NuxtLink>
        </p>
      </template>

      <!-- إكمال وتسجيل الدفع -->
      <form
        v-else-if="mode === 'complete' || mode === 'editPaid'"
        class="flex flex-col gap-3"
        @submit.prevent="mode === 'complete' ? submitComplete() : submitPaid()"
      >
        <label for="paid-amount" class="font-bold">المبلغ الذي دفعه الزبون</label>
        <AppMoneyInput
          id="paid-amount"
          v-model="paid"
          data-autofocus
          aria-describedby="paid-hint"
        />
        <p id="paid-hint" class="text-sm text-fg-muted">
          السعر الافتراضي للخدمة:
          <strong class="text-fg tabular-nums">{{ formatMoney(b.price) }}</strong> — عدّله إن دفع
          الزبون مبلغاً مختلفاً.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="h-9 rounded-full border border-line-strong px-3 text-sm font-semibold tabular-nums hover:border-gold-500"
            @click="paid = b.price"
          >
            {{ formatMoney(b.price) }}
          </button>
        </div>
      </form>

      <!-- إلغاء -->
      <div v-else-if="mode === 'cancel'" class="flex flex-col gap-3">
        <p class="text-[15px] text-fg-muted">سيصبح وقت هذا الحجز متاحاً لحجز آخر فوراً.</p>
        <label for="cancel-reason" class="font-bold"
          >سبب الإلغاء <span class="text-sm font-normal text-fg-muted">(اختياري)</span></label
        >
        <div class="flex flex-wrap gap-2">
          <button
            v-for="r in CANCEL_REASONS"
            :key="r"
            type="button"
            :aria-pressed="reason === r"
            :class="
              cn(
                'h-9 rounded-full border px-3 text-sm font-semibold transition-colors',
                reason === r
                  ? 'border-ink-950 bg-ink-950 text-white'
                  : 'border-line-strong hover:border-gold-500',
              )
            "
            @click="reason = reason === r ? '' : r"
          >
            {{ r }}
          </button>
        </div>
        <AppTextarea
          id="cancel-reason"
          v-model="reason"
          rows="2"
          maxlength="200"
          placeholder="أو اكتب سبباً آخر…"
        />
      </div>
    </div>

    <template v-if="b" #footer>
      <template v-if="mode === 'details'">
        <template v-if="b.status === 'ACTIVE'">
          <AppButton
            v-if="can('bookings.cancel')"
            variant="danger-soft"
            icon="ban"
            class="sm:me-auto"
            @click="mode = 'cancel'"
          >
            إلغاء الحجز
          </AppButton>
          <AppButton
            v-if="can('bookings.update')"
            variant="secondary"
            icon="pencil"
            :to="`/bookings/${b.id}/edit`"
            @click="open = false"
          >
            تعديل الموعد
          </AppButton>
          <AppButton
            v-if="can('bookings.complete')"
            variant="gold"
            icon="check"
            @click="startComplete"
          >
            إكمال وتسجيل الدفع
          </AppButton>
        </template>
        <template v-else>
          <AppButton
            v-if="can('bookings.delete')"
            variant="ghost"
            icon="trash"
            class="text-danger sm:me-auto"
            :loading="busy"
            @click="remove"
          >
            حذف نهائي
          </AppButton>
          <AppButton
            v-if="can('bookings.update')"
            variant="secondary"
            icon="undo"
            :loading="busy"
            @click="submitReopen"
          >
            إعادة فتح
          </AppButton>
          <AppButton
            v-if="b.status === 'COMPLETED' && can('bookings.update')"
            variant="primary"
            icon="wallet"
            @click="startEditPaid"
          >
            تعديل المبلغ
          </AppButton>
        </template>
      </template>

      <template v-else>
        <AppButton variant="secondary" :disabled="busy" @click="mode = 'details'">رجوع</AppButton>
        <AppButton
          v-if="mode === 'cancel'"
          variant="danger"
          icon="ban"
          :loading="busy"
          @click="submitCancel"
        >
          تأكيد الإلغاء
        </AppButton>
        <AppButton
          v-else-if="mode === 'complete'"
          variant="gold"
          icon="check"
          :loading="busy"
          @click="submitComplete"
        >
          تأكيد الإكمال
        </AppButton>
        <AppButton v-else variant="primary" icon="check" :loading="busy" @click="submitPaid"
          >حفظ المبلغ</AppButton
        >
      </template>
    </template>
  </AppModal>
</template>
