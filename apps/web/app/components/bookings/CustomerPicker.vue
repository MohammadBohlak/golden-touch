<script setup lang="ts">
import { useFormContext } from 'vee-validate'
import type { Customer, CustomerRef, Paginated } from '~/types/api'

/**
 * اختيار زبون موجود (بحث بالاسم أو الهاتف) أو إدخال زبون جديد.
 * الحقول customerName و customerPhone مربوطة بنموذج vee-validate الأب عبر FormField.
 */
const customerId = defineModel<string | null | undefined>('customerId')
const selected = defineModel<CustomerRef | null>('selected', { default: null })

const { $api } = useNuxtApp()
const { setFieldValue, values } = useFormContext()

const query = computed(() => {
  const name = String(values.customerName ?? '').trim()
  const phone = String(values.customerPhone ?? '').trim()
  return phone.length >= 3 ? phone : name
})
const debounced = useDebounced(query, 300)

const { data, loading, execute, abort } = useApiState((signal, search: string) =>
  $api<Paginated<Customer>>('/customers', { query: { search, limit: 5 }, signal }),
)

watch(debounced, (value) => {
  if (customerId.value) return
  if (value.length >= 2) void execute(value)
  else {
    abort()
    data.value = null
  }
})

const suggestions = computed(() => (customerId.value ? [] : (data.value?.items ?? [])))

function choose(customer: CustomerRef) {
  customerId.value = customer.id
  selected.value = customer
  setFieldValue('customerName', customer.name)
  setFieldValue('customerPhone', customer.phone ?? '')
}

function clear() {
  customerId.value = null
  selected.value = null
  setFieldValue('customerName', '')
  setFieldValue('customerPhone', '')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- زبون مختار -->
    <div
      v-if="customerId && selected"
      class="flex items-center gap-3 rounded-2xl border-2 border-ink-950 bg-surface p-3"
    >
      <span
        class="grid size-11 shrink-0 place-items-center rounded-full bg-gold-300 font-bold text-ink-950"
      >
        {{ initials(selected.name) }}
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate font-bold">{{ selected.name }}</p>
        <p class="text-sm text-fg-muted tabular-nums" dir="ltr">
          {{ selected.phone ?? 'بلا رقم هاتف' }}
        </p>
      </div>
      <AppButton variant="secondary" size="sm" @click="clear">تغيير</AppButton>
    </div>

    <template v-else>
      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="customerName"
        label="اسم الزبون"
        required
      >
        <AppInput
          :id="id"
          v-bind="field"
          icon="user"
          autocomplete="off"
          placeholder="ابحث باسم زبون سابق أو اكتب اسماً جديداً"
          :invalid="invalid"
          :aria-describedby="describedBy"
          maxlength="80"
        />
      </FormField>
      <FormField
        v-slot="{ field, id, invalid, describedBy }"
        name="customerPhone"
        label="رقم الهاتف"
        hint="اختياري — يفيد في التذكير عبر واتساب والتعرف على الزبون لاحقاً"
      >
        <AppInput
          :id="id"
          v-bind="field"
          type="tel"
          inputmode="tel"
          dir="ltr"
          icon="phone"
          autocomplete="off"
          placeholder="09xx xxx xxx"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <div
        v-if="suggestions.length || loading"
        class="rounded-2xl border border-line bg-surface p-2"
        aria-live="polite"
      >
        <p class="px-2 pt-1 pb-2 text-xs font-bold text-fg-muted">
          {{ loading ? 'جارٍ البحث…' : 'زبائن مطابقون — اضغط للاختيار' }}
        </p>
        <ul class="flex flex-col">
          <li v-for="customer in suggestions" :key="customer.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-surface-muted"
              @click="choose(customer)"
            >
              <span
                class="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-bold"
              >
                {{ initials(customer.name) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ customer.name }}</span>
                <span class="block text-xs text-fg-muted">
                  <span dir="ltr">{{ customer.phone ?? '—' }}</span> · {{ customer.visits }} زيارة
                </span>
              </span>
              <AppIcon name="plus" :size="18" class="text-brand-ink" />
            </button>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
