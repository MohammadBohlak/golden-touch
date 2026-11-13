<script setup lang="ts">
import type { Customer } from '~/types/api'
import type { HighlightParts } from '~/utils/suggest'

/**
 * قائمة اقتراحات الزبائن السابقين تحت حقل الكتابة (listbox لـ combobox يتحكم به الأب بلوحة المفاتيح).
 * تبقى في التدفق (لا تعويم) كي لا يقصّها غلاف AutoHeight ولا تحجبها لوحة مفاتيح الموبايل.
 * الصف النشط يُحدَّد بالأسهم أو بالمؤشر؛ mousedown.prevent يُبقي التركيز في الحقل فلا يُغلق قبل النقر.
 */
defineProps<{
  id: string
  items: { customer: Customer; parts: HighlightParts }[]
  active: number
  loading: boolean
  /** لا نتائج بعد انتهاء البحث */
  empty: boolean
  visible: boolean
}>()
defineEmits<{ choose: [customer: Customer]; hover: [index: number] }>()
</script>

<template>
  <ExpandTransition>
    <div
      v-if="visible"
      class="overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-card"
    >
      <ul
        v-if="items.length"
        :id="id"
        role="listbox"
        aria-label="زبائن سابقون مطابقون"
        class="flex flex-col p-1"
      >
        <li
          v-for="(item, i) in items"
          :id="`${id}-${i}`"
          :key="item.customer.id"
          role="option"
          :aria-selected="i === active"
          :class="
            cn(
              'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2',
              i === active ? 'bg-gold-50' : 'hover:bg-surface-muted',
            )
          "
          @mousedown.prevent
          @mousemove="$emit('hover', i)"
          @click="$emit('choose', item.customer)"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted font-bold"
          >
            {{ initials(item.customer.name) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold"
              >{{ item.parts.before
              }}<mark
                v-if="item.parts.match"
                class="bg-transparent font-extrabold underline decoration-gold-500 decoration-2 underline-offset-4"
                >{{ item.parts.match }}</mark
              >{{ item.parts.after }}</span
            >
            <span :class="cn('block text-sm', i === active ? 'text-fg' : 'text-fg-muted')">
              <span dir="ltr" class="tabular-nums">{{ item.customer.phone ?? 'بلا هاتف' }}</span>
              <template v-if="item.customer.visits !== undefined">
                · {{ item.customer.visits }} زيارة</template
              >
            </span>
          </span>
          <AppIcon name="plus" :size="18" class="shrink-0 text-brand-ink" />
        </li>
      </ul>
      <p v-else-if="loading" class="flex items-center gap-2 px-3.5 py-3 text-sm text-fg-muted">
        <AppSpinner />
        جارٍ البحث…
      </p>
      <p v-else-if="empty" class="flex items-center gap-2 px-3.5 py-3 text-sm text-fg-muted">
        <AppIcon name="user-plus" :size="16" class="shrink-0" />
        لا زبون مطابق — سيُسجَّل كزبون جديد
      </p>
    </div>
  </ExpandTransition>
</template>
