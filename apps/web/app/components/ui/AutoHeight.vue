<script setup lang="ts">
/**
 * يحرّك ارتفاع الحاوية بسلاسة عندما يتغيّر ارتفاع محتواها دفعة واحدة (تبدّل وضع، استبدال فرع…).
 *
 *   <AutoHeight><Transition name="fade" mode="out-in"><div :key="mode">…</div></Transition></AutoHeight>
 *
 * - القياس عبر ResizeObserver بحجم التخطيط (لا يتأثر بـ transform الأب كتكبير الحوار أثناء دخوله).
 * - أول قياس بلا حركة، والحركة تُفعَّل بعد الرسم الأول. قبل التركيب (SSR) الارتفاع تلقائي.
 * - تغيّرات متلاحقة (محتوى داخلي يتحرك كـ ExpandTransition) يتبعها فوراً بلا transition كي لا يقصّ المحتوى.
 * - bleed: هامش سلبي + حشوة متساويان كي لا يقصّ overflow حلقات التركيز والظلال على الحواف.
 */
withDefaults(defineProps<{ bleed?: string }>(), { bleed: '-m-1.5 p-1.5' })

// box-content في القالب: الارتفاع المضبوط للمحتوى وحده، والحشوة (bleed) فوقه
/** فاصل بين قياسين يعدّ التغيّر «متصلاً» (أقل من إطارين تقريباً) */
const CONTINUOUS_MS = 80
const inner = ref<HTMLElement>()
const height = ref<number | null>(null)
const animated = ref(false)
/** تغيّرات متلاحقة (محتوى يتحرّك داخلياً كـ ExpandTransition): نتبعها فوراً بلا transition كي لا يتأخر الإطار ويقصّ المحتوى */
const following = ref(false)
let lastChange = 0
let observer: ResizeObserver | undefined

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    const now = performance.now()
    following.value = now - lastChange < CONTINUOUS_MS
    lastChange = now
    if (entry) height.value = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
  })
  if (inner.value) observer.observe(inner.value)
  requestAnimationFrame(() => requestAnimationFrame(() => (animated.value = true)))
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <!-- pointer-events: منطقة الحشوة السلبية لا تعترض نقرات العناصر المجاورة -->
  <div
    :class="
      cn(
        'pointer-events-none box-content overflow-hidden',
        animated && !following && 'transition-[height] duration-(--motion-base) ease-out-soft',
        bleed,
      )
    "
    :style="height === null ? undefined : { height: `${height}px` }"
  >
    <div ref="inner" class="pointer-events-auto flow-root">
      <slot />
    </div>
  </div>
</template>
