<script setup lang="ts" generic="T extends Record<string, unknown>">
import type { TableColumn } from '~/types/ui'

/**
 * جدول متجاوب: جدول كامل من md فما فوق، وبطاقات مكدّسة على الموبايل.
 * خلايا مخصصة عبر slots باسم cell-<key> تستقبل { row }.
 */
defineProps<{
  columns: TableColumn[]
  rows: T[]
  rowKey: keyof T
  caption?: string
}>()
</script>

<template>
  <div>
    <div
      class="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block"
    >
      <table class="w-full text-start text-sm">
        <caption v-if="caption" class="sr-only">
          {{
            caption
          }}
        </caption>
        <thead class="bg-surface-muted text-fg-muted">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              :class="cn('px-4 py-3 text-start font-semibold', column.class)"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="row in rows"
            :key="String(row[rowKey])"
            class="transition-colors hover:bg-gold-50/40"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              :class="cn('px-4 py-3 align-middle', column.class)"
            >
              <slot :name="`cell-${column.key}`" :row="row">{{ row[column.key] }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul class="flex flex-col gap-3 md:hidden" :aria-label="caption">
      <li
        v-for="row in rows"
        :key="String(row[rowKey])"
        class="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <slot name="mobile" :row="row">
          <dl class="flex flex-col gap-2">
            <div
              v-for="column in columns.filter((c) => !c.hideOnMobile)"
              :key="column.key"
              class="flex items-center justify-between gap-3"
            >
              <dt class="text-sm text-fg-muted">{{ column.label }}</dt>
              <dd class="text-end">
                <slot :name="`cell-${column.key}`" :row="row">{{ row[column.key] }}</slot>
              </dd>
            </div>
          </dl>
        </slot>
      </li>
    </ul>
  </div>
</template>
