<script setup lang="ts">
import { useFormContext } from 'vee-validate'
import type { Customer, CustomerRef, Paginated } from '~/types/api'

/**
 * اختيار زبون موجود أو إدخال زبون جديد، باقتراحات فورية أثناء الكتابة (نمط اقتراحات جوجل):
 * قائمة تحت الحقل الذي تكتب فيه (الاسم أو الهاتف)، تُرتَّب بما يبدأ بما كتبتَ أولاً مع إبراز المطابق،
 * وتعمل بلوحة المفاتيح (↑ ↓ Enter Esc). الحقلان customerName و customerPhone مربوطان بنموذج vee-validate الأب.
 */
const customerId = defineModel<string | null | undefined>('customerId')
const selected = defineModel<CustomerRef | null>('selected', { default: null })

const { $api } = useNuxtApp()
const { supported: contactsSupported } = useContactPicker()
const { setFieldValue, values } = useFormContext()

type FieldKey = 'name' | 'phone'
/** الحقل الذي فيه المؤشر الآن؛ منه تُشتق جملة البحث وتحته تظهر القائمة */
const focusField = ref<FieldKey | null>(null)
const dismissed = ref(false)
const active = ref(-1)

const name = computed(() => String(values.customerName ?? '').trim())
const phone = computed(() => String(values.customerPhone ?? '').trim())
/** جملة البحث من الحقل الذي فيه المؤشر: الهاتف من 3 خانات، والاسم من حرف واحد */
const query = computed(() =>
  focusField.value === 'phone' ? (phone.value.length >= 3 ? phone.value : '') : name.value,
)
const debounced = useDebounced(query, 200)

const { data, loading, execute, abort } = useApiState((signal, search: string) =>
  $api<Paginated<Customer>>('/customers', { query: { search, limit: 8 }, signal }),
)

watch(debounced, (value) => {
  if (customerId.value) return
  if (value.length >= 1) void execute(value)
  else {
    abort()
    data.value = null
  }
})

/** مرتَّبة ومصفّاة بما كُتب الآن (قبل وصول استجابة الطلب التالي) */
const suggestions = computed(() =>
  customerId.value ? [] : rankSuggestions(data.value?.items ?? [], query.value),
)
const rows = computed(() =>
  suggestions.value.map((customer) => ({
    customer,
    // الإبراز على الاسم فقط (البحث بالهاتف لا يبرز شيئاً)
    parts: splitHighlight(customer.name, focusField.value === 'phone' ? '' : name.value),
  })),
)

const typing = computed(() => !dismissed.value && focusField.value !== null)
/** لا نتائج بعد انتهاء البحث (والاستعلام طويل بما يكفي ليكون زبوناً جديداً فعلاً) */
const noMatch = computed(
  () =>
    !loading.value && data.value !== null && !suggestions.value.length && name.value.length >= 2,
)
const listVisible = (field: FieldKey) =>
  typing.value &&
  focusField.value === field &&
  !customerId.value &&
  query.value.length > 0 &&
  (suggestions.value.length > 0 || loading.value || noMatch.value)

const listId = useId()
const panelId = (field: FieldKey) => `${listId}-${field}`
const expanded = (field: FieldKey) => listVisible(field) && suggestions.value.length > 0
const activeOption = (field: FieldKey) =>
  expanded(field) && active.value >= 0 ? `${panelId(field)}-${active.value}` : undefined

// القائمة الجديدة تبدأ بلا صف محدد (كجوجل: Enter بلا تحديد يتابع السلوك المعتاد للنموذج)
watch(suggestions, () => (active.value = -1))

function onFocus(field: FieldKey) {
  focusField.value = field
  dismissed.value = false
}
function onBlur(field: FieldKey) {
  if (focusField.value === field) focusField.value = null
  active.value = -1
}

function onKeydown(event: KeyboardEvent, field: FieldKey) {
  const count = suggestions.value.length
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!count || focusField.value !== field) return
    event.preventDefault()
    dismissed.value = false
    const step = event.key === 'ArrowDown' ? 1 : -1
    active.value =
      active.value < 0 ? (step === 1 ? 0 : count - 1) : (active.value + step + count) % count
  } else if (event.key === 'Enter') {
    const pick = suggestions.value[active.value]
    if (expanded(field) && pick) {
      event.preventDefault()
      choose(pick)
    }
  } else if (event.key === 'Escape' && listVisible(field)) {
    event.preventDefault()
    event.stopPropagation()
    dismissed.value = true
    active.value = -1
  }
}

function choose(customer: CustomerRef) {
  customerId.value = customer.id
  selected.value = customer
  setFieldValue('customerName', customer.name)
  setFieldValue('customerPhone', customer.phone ?? '')
  focusField.value = null
  active.value = -1
}

function clear() {
  customerId.value = null
  selected.value = null
  dismissed.value = false
  setFieldValue('customerName', '')
  setFieldValue('customerPhone', '')
}
</script>

<template>
  <!-- زبون مختار ⇄ حقول الإدخال: تبدّل بتلاشٍ وارتفاع المنتقي يتغيّر بسلاسة -->
  <AutoHeight>
    <Transition name="fade" mode="out-in">
      <div
        v-if="customerId && selected"
        key="selected"
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

      <div v-else key="fields" class="flex flex-col gap-3">
        <FormField
          v-slot="{ field, id, invalid, describedBy }"
          name="customerName"
          label="اسم الزبون"
          required
        >
          <div class="flex flex-col gap-2">
            <AppInput
              :id="id"
              v-bind="field"
              icon="user"
              autocomplete="off"
              placeholder="ابحث باسم زبون سابق أو اكتب اسماً جديداً"
              :invalid="invalid"
              :aria-describedby="describedBy"
              maxlength="80"
              role="combobox"
              aria-autocomplete="list"
              :aria-expanded="expanded('name')"
              :aria-controls="panelId('name')"
              :aria-activedescendant="activeOption('name')"
              @focus="onFocus('name')"
              @blur="onBlur('name')"
              @input="dismissed = false"
              @keydown="onKeydown($event, 'name')"
            />
            <CustomerSuggestions
              :id="panelId('name')"
              :visible="listVisible('name')"
              :items="rows"
              :active="active"
              :loading="loading"
              :empty="noMatch"
              @choose="choose"
              @hover="active = $event"
            />
          </div>
        </FormField>
        <FormField
          v-slot="{ field, id, invalid, describedBy }"
          name="customerPhone"
          label="رقم الهاتف"
          hint="اختياري — يفيد في التذكير عبر واتساب والتعرف على الزبون لاحقاً"
        >
          <div class="flex flex-col gap-2">
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
              role="combobox"
              aria-autocomplete="list"
              :aria-expanded="expanded('phone')"
              :aria-controls="panelId('phone')"
              :aria-activedescendant="activeOption('phone')"
              @focus="onFocus('phone')"
              @blur="onBlur('phone')"
              @input="dismissed = false"
              @keydown="onKeydown($event, 'phone')"
            >
              <template v-if="contactsSupported" #end>
                <PhoneContactButton @pick="field['onUpdate:modelValue']($event)" />
              </template>
            </AppInput>
            <CustomerSuggestions
              :id="panelId('phone')"
              :visible="listVisible('phone')"
              :items="rows"
              :active="active"
              :loading="loading"
              :empty="false"
              @choose="choose"
              @hover="active = $event"
            />
          </div>
        </FormField>
      </div>
    </Transition>
  </AutoHeight>
</template>
