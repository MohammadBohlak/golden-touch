import type { Ref } from 'vue'

/**
 * سحب الورقة السفلية لأسفل للإغلاق (موبايل فقط). تُربط المعالجات بمقبض الورقة وترويستها
 * (وليس بجسمها كي لا يتعارض مع التمرير). الورقة تتبع الإصبع، وتخفّ عتمة الخلفية، ثم:
 * إغلاق (تنزلق للخارج) أو ارتداد إلى مكانها.
 */
export function useSheetDrag(options: {
  panel: Ref<HTMLElement | undefined>
  enabled: () => boolean
  onDismiss: () => void
}) {
  interface Drag {
    id: number
    startY: number
    lastY: number
    lastT: number
    velocity: number
    height: number
  }
  let drag: Drag | null = null

  const overlay = () => options.panel.value?.parentElement ?? null
  const isMobile = () => window.matchMedia('(max-width: 39.99rem)').matches

  function setProgress(dy: number, height: number) {
    overlay()?.style.setProperty('--drag', String(dragProgress(dy, height)))
  }

  function onPointerDown(event: PointerEvent) {
    const panel = options.panel.value
    if (!panel || !options.enabled() || !isMobile() || event.button > 0) return
    // أزرار الترويسة (إغلاق…) تعمل بالنقر لا بالسحب
    if ((event.target as Element).closest('button, a, input, textarea, select')) return
    drag = {
      id: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      height: panel.offsetHeight,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    panel.style.transition = 'none'
  }

  function onPointerMove(event: PointerEvent) {
    const panel = options.panel.value
    if (!drag || !panel || event.pointerId !== drag.id) return
    const dy = Math.max(0, event.clientY - drag.startY)
    const dt = event.timeStamp - drag.lastT
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt
    drag.lastY = event.clientY
    drag.lastT = event.timeStamp
    panel.style.translate = `0 ${dy}px`
    setProgress(dy, drag.height)
  }

  function onPointerUp(event: PointerEvent) {
    const panel = options.panel.value
    if (!drag || !panel || event.pointerId !== drag.id) return
    const dy = Math.max(0, event.clientY - drag.startY)
    const { velocity, height } = drag
    drag = null

    if (shouldDismissSheet(dy, height, velocity)) {
      // تكمل الورقة نزولها من موضع الإصبع، والخلفية تتلاشى مع انتقال Vue للإغلاق
      panel.style.transition = `translate var(--motion-slow-exit) var(--ease-in-soft)`
      panel.style.translate = '0 100%'
      options.onDismiss()
      return
    }
    // ارتداد
    panel.style.transition = `translate var(--motion-base) var(--ease-out-soft)`
    panel.style.translate = '0 0'
    setProgress(0, height)
    window.setTimeout(() => {
      panel.style.transition = ''
      panel.style.translate = ''
    }, MOTION.base + 30)
  }

  return {
    handlers: {
      onPointerdown: onPointerDown,
      onPointermove: onPointerMove,
      onPointerup: onPointerUp,
      onPointercancel: onPointerUp,
    },
  }
}
