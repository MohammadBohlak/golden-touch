<script setup lang="ts">
/**
 * رقم يعدّ تصاعدياً/تنازلياً إلى قيمته الجديدة (مبالغ، إحصاءات).
 *
 *   <AnimatedNumber :value="total" :format="formatMoney" appear />
 *
 * - appear: يعدّ من الصفر عند أول ظهور على العميل (لا أثناء الـ hydration كي لا يختلف النص عن HTML الخادم).
 * - تقليل الحركة: تقفز القيمة مباشرة.
 * - الإتاحة: القيمة النهائية فقط لقارئ الشاشة (sr-only)، والنص المتغيّر مخفي عنه كي لا يُقرأ كل رقم وسيط.
 */
const props = withDefaults(
  defineProps<{
    value: number
    format?: (value: number) => string
    /** مدة العدّ بالميلي ثانية */
    duration?: number
    appear?: boolean
  }>(),
  { format: (value: number) => String(value), duration: 700, appear: false },
)

const nuxtApp = useNuxtApp()
const counting = props.appear && import.meta.client && !nuxtApp.isHydrating
const shown = ref(counting ? 0 : props.value)
let frame = 0

function animateTo(target: number) {
  cancelAnimationFrame(frame)
  const from = shown.value
  if (from === target || prefersReducedMotion()) {
    shown.value = target
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const progress = (now - start) / props.duration
    shown.value = tweenValue(from, target, progress)
    if (progress < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => {
  if (counting) animateTo(props.value)
})
watch(
  () => props.value,
  (next) => animateTo(next),
)
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <span class="tabular-nums">
    <span class="sr-only">{{ format(value) }}</span>
    <span aria-hidden="true">{{ format(shown) }}</span>
  </span>
</template>
