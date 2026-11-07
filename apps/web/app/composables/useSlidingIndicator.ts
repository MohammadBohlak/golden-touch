import type { Ref, WatchSource } from 'vue'

/**
 * مؤشر منزلق خلف العنصر النشط داخل حاوية (شريط تنقل). يقيس موضع العنصر الذي يطابق `selector`
 * فيُحرَّك المؤشر إليه بـ transform عند تغيّر `source` (المسار مثلاً) أو حجم الحاوية.
 *
 * - `ready` يصير true بعد أول قياس على العميل؛ قبله (SSR) يعرض المكوّن خلفية العنصر النشط
 *   الثابتة كي لا يغيب التحديد قبل hydration، ثم يسلّم للمؤشر دون وميض.
 * - `animated` يفعّل الحركة بعد الرسم الأول؛ وأول ظهور للمؤشر (لم يكن له موضع سابق) يُوضَع دون انزلاق.
 * - إن لم يوجد عنصر نشط يتلاشى المؤشر ويبقى في موضعه الأخير.
 * - الإحداثيات فيزيائية (يسار/أعلى) لأنها قياسات تخطيط فعلية وليست تنسيقاً اتجاهياً، فتصح في RTL.
 */
export function useSlidingIndicator(
  container: Ref<HTMLElement | undefined>,
  selector: string,
  source: WatchSource,
) {
  const box = ref({ x: 0, y: 0, width: 0, height: 0 })
  const placed = ref(false)
  const visible = ref(false)
  const ready = ref(false)
  const animated = ref(false)
  /** وضع بلا حركة لإطار واحد عند أول تموضع */
  const snapping = ref(false)

  function measure() {
    const root = container.value
    if (!root) return
    const target = root.querySelector<HTMLElement>(selector)
    if (!target) {
      visible.value = false
      return
    }
    const a = root.getBoundingClientRect()
    const b = target.getBoundingClientRect()
    if (!placed.value) {
      snapping.value = true
      requestAnimationFrame(() => requestAnimationFrame(() => (snapping.value = false)))
    }
    box.value = {
      x: b.left - a.left + root.scrollLeft,
      y: b.top - a.top + root.scrollTop,
      width: b.width,
      height: b.height,
    }
    placed.value = true
    visible.value = true
  }

  onMounted(() => {
    measure()
    ready.value = true
    requestAnimationFrame(() => requestAnimationFrame(() => (animated.value = true)))

    const observer = new ResizeObserver(measure)
    if (container.value) observer.observe(container.value)
    onBeforeUnmount(() => observer.disconnect())
  })

  watch(source, () => nextTick(measure), { flush: 'post' })

  const style = computed(() => ({
    width: `${box.value.width}px`,
    height: `${box.value.height}px`,
    transform: `translate(${box.value.x}px, ${box.value.y}px)`,
    opacity: visible.value ? 1 : 0,
  }))

  /** أصناف الانتقال: transform بحركة in-out بعد التفعيل، وopacity دائماً */
  const motionClass = computed(() =>
    animated.value && !snapping.value
      ? 'transition-[transform,width,height,opacity] duration-(--motion-page) ease-in-out-soft'
      : 'transition-opacity duration-(--motion-fast)',
  )

  return { style, motionClass, ready, measure }
}
