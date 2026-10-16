<script setup lang="ts">
import type { ToastTone } from '~/composables/useToast'
import type { IconName } from '~/utils/icons'

const { toasts, dismiss, runAction } = useToast()

const tones: Record<ToastTone, { icon: IconName; class: string }> = {
  success: { icon: 'check-circle', class: 'text-gold-300' },
  error: { icon: 'alert', class: 'text-red-300' },
  info: { icon: 'info', class: 'text-ink-300' },
}
</script>

<template>
  <div
    aria-live="polite"
    aria-atomic="false"
    class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] lg:top-auto lg:bottom-6 lg:pt-0"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2 lg:translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink-950 py-3 ps-4 pe-2 text-white shadow-float"
      >
        <AppIcon :name="tones[toast.tone].icon" :class="tones[toast.tone].class" />
        <p class="min-w-0 flex-1 text-[15px] leading-snug font-medium">{{ toast.message }}</p>
        <button
          v-if="toast.actionLabel"
          type="button"
          class="h-9 shrink-0 rounded-lg px-3 text-sm font-bold text-gold-300 hover:bg-white/10"
          @click="runAction(toast.id)"
        >
          {{ toast.actionLabel }}
        </button>
        <button
          type="button"
          class="grid size-9 shrink-0 place-items-center rounded-lg text-ink-300 hover:bg-white/10"
          aria-label="إغلاق الإشعار"
          @click="dismiss(toast.id)"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
