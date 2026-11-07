<script setup lang="ts">
/**
 * ظهور/اختفاء عنصر `v-if` بتحريك الارتفاع (أو العرض) والشفافية والحشوات والهوامش (WAAPI).
 *
 *   <ExpandTransition><p v-if="error">…</p></ExpandTransition>
 *   <ExpandTransition axis="x"><AppSpinner v-if="loading" /></ExpandTransition>
 *
 * - يعوّض `gap` الأب (flex/grid) كي لا يظهر فراغ الـ gap فجأة عند بدء الحركة.
 * - قابل للمقاطعة: الإظهار والإخفاء المتتاليان يبدآن من الحالة المرئية الحالية.
 * - تقليل الحركة: تلاشٍ فقط بلا تغيير حجم.
 * - للقوائم استخدم ListTransition؛ ولأقسام مفتوحة-مغلقة دائمة الحضور استخدم Collapse.
 */
const props = withDefaults(
  defineProps<{
    /** مدة الدخول بالميلي ثانية (الخروج ≈ 65%) */
    duration?: number
    mode?: 'in-out' | 'out-in'
    /** y: ارتفاع (افتراضي) · x: عرض (عنصر داخل صف flex أفقي) */
    axis?: 'x' | 'y'
  }>(),
  { duration: MOTION.base, mode: undefined, axis: 'y' },
)

const running = new WeakMap<Element, Animation>()

/** يوقف حركة جارية دون استدعاء done (لأن Vue نفسه هو من ألغى الانتقال) */
function stop(el: Element): void {
  const animation = running.get(el)
  if (!animation) return
  running.delete(el)
  animation.onfinish = null
  animation.oncancel = null
  animation.cancel()
}

/** هل للعنصر جار فعلي (عنصر أو نص غير فارغ) في الاتجاه المعطى؟ التعليقات والفراغات لا تُحتسب */
function hasSibling(el: Element, direction: 'previous' | 'next'): boolean {
  let node = direction === 'previous' ? el.previousSibling : el.nextSibling
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) return true
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true
    node = direction === 'previous' ? node.previousSibling : node.nextSibling
  }
  return false
}

/** مقدار الـ gap الذي يجب إلغاؤه عند الإغلاق الكامل، وفي أي جهة (بداية/نهاية المحور) */
function gapCompensation(el: HTMLElement, vertical: boolean): { start: number; end: number } {
  const none = { start: 0, end: 0 }
  const parent = el.parentElement
  if (!parent) return none
  const style = getComputedStyle(parent)
  const isFlex = style.display.includes('flex')
  const isGrid = style.display.includes('grid')
  const column = style.flexDirection.startsWith('column')
  const along = vertical ? (isFlex && column) || isGrid : isFlex && !column
  if (!along) return none
  const gap = Number.parseFloat(vertical ? style.rowGap : style.columnGap) || 0
  if (!gap) return none
  if (hasSibling(el, 'previous')) return { start: gap, end: 0 }
  if (hasSibling(el, 'next')) return { start: 0, end: gap }
  return none
}

/** خصائص الحجم والتباعد على المحور الحالي */
function axisProps(vertical: boolean) {
  return vertical
    ? {
        size: 'height',
        padStart: 'paddingTop',
        padEnd: 'paddingBottom',
        marginStart: 'marginTop',
        marginEnd: 'marginBottom',
      }
    : {
        size: 'width',
        padStart: 'paddingInlineStart',
        padEnd: 'paddingInlineEnd',
        marginStart: 'marginInlineStart',
        marginEnd: 'marginInlineEnd',
      }
}

type Axis = ReturnType<typeof axisProps>

function readStyle(el: HTMLElement, axis: Axis, vertical: boolean) {
  const style = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  return {
    [axis.size]: `${vertical ? rect.height : rect.width}px`,
    [axis.padStart]: style.getPropertyValue(toKebab(axis.padStart)),
    [axis.padEnd]: style.getPropertyValue(toKebab(axis.padEnd)),
    [axis.marginStart]: style.getPropertyValue(toKebab(axis.marginStart)),
    [axis.marginEnd]: style.getPropertyValue(toKebab(axis.marginEnd)),
  }
}

function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/** الحالة المرئية الراهنة (بما فيها أثر حركة جارية) */
function snapshot(el: HTMLElement, axis: Axis, vertical: boolean): Keyframe {
  return {
    ...readStyle(el, axis, vertical),
    opacity: getComputedStyle(el).opacity,
    overflow: 'hidden',
  }
}

function openFrame(el: HTMLElement, axis: Axis, vertical: boolean): Keyframe {
  return { ...readStyle(el, axis, vertical), opacity: 1, overflow: 'hidden' }
}

function closedFrame(el: HTMLElement, axis: Axis, vertical: boolean): Keyframe {
  const { start, end } = gapCompensation(el, vertical)
  return {
    [axis.size]: '0px',
    [axis.padStart]: '0px',
    [axis.padEnd]: '0px',
    [axis.marginStart]: `${-start}px`,
    [axis.marginEnd]: `${-end}px`,
    opacity: 0,
    overflow: 'hidden',
  }
}

function run(el: Element, entering: boolean, done: () => void): void {
  const target = el as HTMLElement
  const vertical = props.axis === 'y'
  const axis = axisProps(vertical)
  const interrupted = running.has(target) ? snapshot(target, axis, vertical) : null
  stop(target)

  const reduced = prefersReducedMotion()
  let from: Keyframe
  let to: Keyframe
  if (reduced) {
    from = { opacity: interrupted ? interrupted.opacity : entering ? 0 : 1 }
    to = { opacity: entering ? 1 : 0 }
  } else if (entering) {
    from = interrupted ?? closedFrame(target, axis, vertical)
    to = openFrame(target, axis, vertical)
  } else {
    from = interrupted ?? openFrame(target, axis, vertical)
    to = closedFrame(target, axis, vertical)
  }

  const animation = target.animate([from, to], {
    duration: reduced ? MOTION.instant : entering ? props.duration : exitDuration(props.duration),
    easing: entering ? EASING.out : EASING.in,
    // عند الخروج نثبّت الحالة النهائية حتى يزيل Vue العنصر فلا يومض
    fill: entering ? 'none' : 'forwards',
  })
  running.set(target, animation)
  const finish = () => {
    running.delete(target)
    done()
  }
  animation.onfinish = finish
  animation.oncancel = finish
}
</script>

<template>
  <Transition
    :css="false"
    :mode="mode"
    @enter="(el, done) => run(el, true, done)"
    @leave="(el, done) => run(el, false, done)"
    @enter-cancelled="stop"
    @leave-cancelled="stop"
  >
    <slot />
  </Transition>
</template>
