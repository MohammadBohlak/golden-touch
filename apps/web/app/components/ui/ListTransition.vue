<script setup lang="ts">
/**
 * TransitionGroup جاهز للقوائم: العناصر المتبقية تنزلق إلى أماكنها (FLIP) حين يُضاف/يُحذف عنصر،
 * والعنصر المغادر يُثبَّت في مكانه وحجمه ثم يتلاشى دون أن يشدّ جيرانه أو يتغيّر عرضه.
 *
 *   <ListTransition tag="ul" class="relative flex flex-col gap-2" appear :stagger="35">
 *     <li v-for="item in items" :key="item.id">…</li>
 *   </ListTransition>
 *
 * - الحاوية يجب أن تكون عنصراً مُموضَعاً (relative/fixed/absolute) كي تصح إحداثيات التثبيت.
 * - لا تستعمله لقائمة تُعرَض على الخادم (SSR): غلاف حول TransitionGroup يجعل الخادم يرسم علامات تجزئة لـ v-for
 *   لا يرسمها العميل فيحدث hydration mismatch — استعمل TransitionGroup مباشرة مع pinElement.
 * - name: يقابل أصناف CSS في main.css (`<name>-enter-active`… و`<name>-move`).
 * - pin=false: لا تثبيت للمغادر (صفوف <tr> لا تحتمل position:absolute) — يتلاشى في مكانه.
 * - appear: حركة العرض الأول. استعمله فقط لقوائم بياناتها تصل بعد التركيب على العميل (لا SSR).
 * - stagger: تأخير بالميلي ثانية بين عناصر العرض الأول (أول 8 عناصر فقط، ويُلغى عند تقليل الحركة).
 */
const props = withDefaults(
  defineProps<{
    tag?: string
    name?: string
    pin?: boolean
    appear?: boolean
    stagger?: number
  }>(),
  { tag: 'div', name: 'list', pin: true, appear: false, stagger: 0 },
)

const MAX_STAGGERED = 8

function pinOnLeave(el: Element) {
  if (props.pin) pinElement(el)
}

function delayAppear(el: Element) {
  if (!props.stagger || prefersReducedMotion()) return
  const index = Array.prototype.indexOf.call(el.parentElement?.children ?? [], el)
  ;(el as HTMLElement).style.transitionDelay =
    `${Math.min(Math.max(index, 0), MAX_STAGGERED) * props.stagger}ms`
}

function clearDelay(el: Element) {
  ;(el as HTMLElement).style.transitionDelay = ''
}
</script>

<template>
  <TransitionGroup
    :tag="tag"
    :name="name"
    :appear="appear"
    @before-leave="pinOnLeave"
    @before-appear="delayAppear"
    @after-appear="clearDelay"
    @appear-cancelled="clearDelay"
  >
    <slot />
  </TransitionGroup>
</template>
