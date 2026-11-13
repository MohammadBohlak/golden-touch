<script setup lang="ts">
import type { RecurringPreview } from '~/types/api'

/**
 * معاينة حيّة قبل الحفظ: أول المواعيد التي ستُنشأ وما يتعذّر (بالسبب)، وعند التعديل أعداد الحذف
 * والإنشاء والمعدّل يدوياً. تبدّل الحالات (انتظار · تحميل · خطأ · محتوى) بتلاشٍ بجذر واحد لكل فرع.
 */
const props = defineProps<{
  preview: RecurringPreview | null
  /** المدخلات غير مكتملة بعد */
  waiting: boolean
  loading: boolean
  errorMessage: string
  editing?: boolean
  timezone: string
  today: string
}>()

const MAX_SHOWN = 8
const shown = computed(() => props.preview?.occurrences.slice(0, MAX_SHOWN) ?? [])
const hidden = computed(() => Math.max(0, (props.preview?.occurrences.length ?? 0) - MAX_SHOWN))
</script>

<template>
  <section aria-labelledby="preview-title" aria-live="polite" class="flex flex-col gap-3">
    <h2 id="preview-title" class="flex items-center gap-2 text-lg font-extrabold">
      <AppIcon name="calendar" :size="20" />
      المواعيد القادمة
    </h2>

    <FadeTransition>
      <p
        v-if="waiting"
        key="waiting"
        class="rounded-2xl bg-surface p-4 text-center text-sm text-fg-muted shadow-card"
      >
        اختر اليوم والوقت والخدمة لعرض المواعيد.
      </p>

      <div
        v-else-if="errorMessage"
        key="error"
        role="alert"
        class="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-red-800"
      >
        <AppIcon name="alert" :size="18" class="mt-0.5 shrink-0" />
        {{ errorMessage }}
      </div>

      <LoadingState v-else-if="!preview" key="loading" variant="spinner" label="جارٍ الحساب…" />

      <div
        v-else
        key="content"
        :class="cn('flex flex-col gap-3 transition-opacity', loading && 'opacity-60')"
        :aria-busy="loading"
      >
        <ul
          v-if="shown.length"
          class="flex flex-col divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-card"
        >
          <li
            v-for="(o, i) in shown"
            :key="o.date"
            class="flex items-center gap-3 px-3.5 py-3 text-[15px]"
          >
            <span
              class="grid size-7 shrink-0 place-items-center rounded-full bg-ink-950 text-sm font-bold text-gold-300 tabular-nums"
              aria-hidden="true"
              >{{ i + 1 }}</span
            >
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">{{ relativeDayLabel(o.date, today) }}</span>
              <span class="block text-sm text-fg-muted">
                {{ formatTimeRange(o.startAt, o.endAt, timezone) }} · {{ o.serviceName }}
              </span>
            </span>
          </li>
          <li v-if="hidden" class="px-3.5 py-3 text-sm text-fg-muted">
            و{{ countAppointments(hidden) }} أخرى بعدها
          </li>
        </ul>
        <p
          v-else-if="!preview.issues.length"
          class="rounded-2xl bg-surface p-4 text-center text-sm text-fg-muted shadow-card"
        >
          لا مواعيد ضمن الأسابيع القادمة — تُنشأ تلقائياً عند اقترابها.
        </p>

        <div
          v-if="preview.issues.length"
          role="status"
          class="flex flex-col gap-1.5 rounded-xl bg-warning-soft p-3 text-amber-900"
        >
          <p class="flex items-center gap-2 text-sm font-bold">
            <AppIcon name="alert" :size="16" class="shrink-0" />
            {{ issuesTitle(preview.issues.length) }}
          </p>
          <ul class="flex flex-col gap-0.5 ps-6 text-sm">
            <li v-for="issue in preview.issues" :key="issue.date">{{ issueLine(issue) }}</li>
          </ul>
        </div>

        <dl
          v-if="editing"
          class="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-line text-center shadow-card"
        >
          <div class="bg-surface p-3">
            <dt class="text-sm text-fg-muted">تُحذف</dt>
            <dd class="text-lg font-extrabold tabular-nums">{{ preview.removeCount }}</dd>
          </div>
          <div class="bg-surface p-3">
            <dt class="text-sm text-fg-muted">تُنشأ</dt>
            <dd class="text-lg font-extrabold tabular-nums">{{ preview.occurrences.length }}</dd>
          </div>
          <div class="bg-surface p-3">
            <dt class="text-sm text-fg-muted">تبقى معدّلة</dt>
            <dd class="text-lg font-extrabold tabular-nums">{{ preview.keptEdited }}</dd>
          </div>
        </dl>
      </div>
    </FadeTransition>
  </section>
</template>
