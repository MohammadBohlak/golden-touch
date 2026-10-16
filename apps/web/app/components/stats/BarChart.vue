<script setup lang="ts">
import type { BarPoint } from '~/types/ui'

/**
 * مخطط أعمدة خفيف بلا مكتبات: لمس/نقر عمود يعرض قيمته، مع ملخص نصي وجدول بديل لقارئ الشاشة.
 */

const props = withDefaults(
  defineProps<{
    points: BarPoint[]
    title: string
    format?: (value: number) => string
    height?: number
  }>(),
  { format: (v: number) => String(v), height: 160 },
)

const selectedKey = ref<string | null>(null)
const max = computed(() => Math.max(1, ...props.points.map((p) => p.value)))
const peak = computed(() =>
  props.points.reduce<BarPoint | null>(
    (best, p) => (!best || p.value > best.value ? p : best),
    null,
  ),
)
const selected = computed(() => props.points.find((p) => p.key === selectedKey.value) ?? peak.value)
const total = computed(() => props.points.reduce((sum, p) => sum + p.value, 0))
// إظهار تسمية كل عمود حين تكون الأعمدة قليلة فقط
const labelEvery = computed(() => Math.ceil(props.points.length / 8))

watch(
  () => props.points,
  () => (selectedKey.value = null),
)
</script>

<template>
  <figure class="flex flex-col gap-3">
    <figcaption class="flex items-baseline justify-between gap-2">
      <span class="font-bold">{{ title }}</span>
      <span v-if="selected && total" class="text-sm text-fg-muted" aria-live="polite">
        {{ selected.label }}:
        <strong class="text-fg tabular-nums">{{ format(selected.value) }}</strong>
      </span>
    </figcaption>

    <p v-if="!total" class="rounded-2xl bg-surface-muted py-10 text-center text-sm text-fg-muted">
      لا توجد بيانات في هذه الفترة بعد.
    </p>

    <template v-else>
      <div
        class="flex items-end gap-[3px] border-b border-line"
        :style="{ height: `${height}px` }"
        aria-hidden="true"
      >
        <button
          v-for="point in points"
          :key="point.key"
          type="button"
          tabindex="-1"
          class="group flex h-full min-w-0 flex-1 items-end"
          @click="selectedKey = point.key"
        >
          <span
            :class="
              cn(
                'block w-full rounded-t-md transition-[height,background-color] duration-300',
                selected?.key === point.key ? 'bg-ink-950' : 'bg-gold-300 group-hover:bg-gold-400',
                point.value === 0 && 'bg-line',
              )
            "
            :style="{ height: `${Math.max(point.value ? 4 : 2, (point.value / max) * 100)}%` }"
          />
        </button>
      </div>
      <div class="flex gap-[3px] text-[10px] text-fg-subtle" aria-hidden="true">
        <span
          v-for="(point, i) in points"
          :key="point.key"
          class="min-w-0 flex-1 truncate text-center tabular-nums"
        >
          {{ i % labelEvery === 0 ? point.short : '' }}
        </span>
      </div>

      <table class="sr-only">
        <caption>
          {{
            title
          }}
        </caption>
        <tbody>
          <tr v-for="point in points" :key="point.key">
            <th scope="row">{{ point.label }}</th>
            <td>{{ format(point.value) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </figure>
</template>
