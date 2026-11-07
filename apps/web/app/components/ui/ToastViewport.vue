<script setup lang="ts">
import type { ToastTone } from '~/composables/useToast'
import type { IconName } from '~/utils/icons'

// TransitionGroup مباشرة لا ListTransition: الإشعارات تُرسم على الخادم (انظر توثيق ListTransition)
const { toasts, dismiss, runAction } = useToast()

const tones: Record<ToastTone, { icon: IconName; class: string }> = {
  success: { icon: 'check-circle', class: 'text-gold-300' },
  error: { icon: 'alert', class: 'text-red-300' },
  info: { icon: 'info', class: 'text-ink-300' },
}

// ── سحب الإشعار أفقياً لإخفائه ──
interface Swipe {
  id: number
  pointerId: number
  startX: number
  lastX: number
  lastT: number
  velocity: number
  width: number
}
let swipe: Swipe | null = null

function onPointerDown(event: PointerEvent, id: number) {
  if (event.button > 0 || (event.target as Element).closest('button')) return
  const el = event.currentTarget as HTMLElement
  swipe = {
    id,
    pointerId: event.pointerId,
    startX: event.clientX,
    lastX: event.clientX,
    lastT: event.timeStamp,
    velocity: 0,
    width: el.offsetWidth,
  }
  el.setPointerCapture(event.pointerId)
  el.style.transition = 'none'
}

function onPointerMove(event: PointerEvent) {
  if (!swipe || event.pointerId !== swipe.pointerId) return
  const el = event.currentTarget as HTMLElement
  const dx = event.clientX - swipe.startX
  const dt = event.timeStamp - swipe.lastT
  if (dt > 0) swipe.velocity = (event.clientX - swipe.lastX) / dt
  swipe.lastX = event.clientX
  swipe.lastT = event.timeStamp
  el.style.translate = `${dx}px 0`
  el.style.opacity = String(1 - Math.min(1, Math.abs(dx) / swipe.width) * 0.7)
}

function onPointerUp(event: PointerEvent) {
  if (!swipe || event.pointerId !== swipe.pointerId) return
  const el = event.currentTarget as HTMLElement
  const { id, width, velocity } = swipe
  const dx = event.clientX - swipe.startX
  swipe = null

  if (shouldDismissSwipe(dx, width, velocity)) {
    const direction = dx < 0 ? -1 : 1
    el.style.transition = `translate var(--motion-base-exit) var(--ease-in-soft), opacity var(--motion-base-exit) var(--ease-in-soft)`
    el.style.translate = `${direction * width}px 0`
    el.style.opacity = '0'
    window.setTimeout(() => dismiss(id), exitDuration(MOTION.base))
    return
  }
  el.style.transition = `translate var(--motion-base) var(--ease-out-soft), opacity var(--motion-base) var(--ease-out-soft)`
  el.style.translate = '0 0'
  el.style.opacity = '1'
  window.setTimeout(() => {
    el.style.transition = ''
    el.style.translate = ''
    el.style.opacity = ''
  }, MOTION.base + 30)
}
</script>

<template>
  <TransitionGroup
    name="toast"
    tag="div"
    aria-live="polite"
    aria-atomic="false"
    class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] lg:top-auto lg:bottom-6 lg:pt-0"
    @before-leave="pinElement"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :role="toast.tone === 'error' ? 'alert' : 'status'"
      class="pointer-events-auto flex w-full max-w-md touch-pan-y items-center gap-3 rounded-2xl bg-ink-950 py-3 ps-4 pe-2 text-white shadow-float"
      @pointerdown="onPointerDown($event, toast.id)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <AppIcon
        :name="tones[toast.tone].icon"
        :class="cn('animate-pop-in', tones[toast.tone].class)"
      />
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
</template>
