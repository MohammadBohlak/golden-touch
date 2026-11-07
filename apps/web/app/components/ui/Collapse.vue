<script setup lang="ts">
/**
 * قسم مفتوح/مغلق بحركة ارتفاع (أو عرض) سلسة عبر grid — يبقى المحتوى في الـ DOM.
 *
 *   <button :aria-expanded="open" aria-controls="x" @click="open = !open">…</button>
 *   <Collapse id="x" :open="open"><div class="pt-2">…</div></Collapse>
 *
 * - يعطّل المحتوى المغلق عن التركيز وقارئ الشاشة (`inert`).
 * - axis="x": انطواء أفقي (زر يظهر بجانب عناصر في صف flex دون أن يقفز جيرانه).
 * - ضع الهوامش/الحشوات داخل المحتوى لا على Collapse نفسه، ولا تضعه مباشرة داخل أب بـ gap
 *   (الـ gap يبقى ظاهراً وهو مغلق) — لعناصر v-if داخل أب بـ gap استخدم ExpandTransition.
 * - innerClass: مثلاً `-mx-1 px-1` كي لا يقصّ overflow حلقات التركيز على الحواف.
 */
withDefaults(defineProps<{ open: boolean; innerClass?: string; axis?: 'x' | 'y' }>(), {
  innerClass: undefined,
  axis: 'y',
})
</script>

<template>
  <div
    :inert="!open"
    :class="
      cn(
        'grid',
        axis === 'y'
          ? [
              'transition-[grid-template-rows,opacity]',
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            ]
          : [
              'transition-[grid-template-columns,opacity]',
              open ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]',
            ],
        open
          ? 'opacity-100 duration-(--motion-base) ease-out-soft'
          : 'opacity-0 duration-(--motion-base-exit) ease-in-soft',
      )
    "
  >
    <div :class="cn('min-h-0 min-w-0 overflow-hidden', innerClass)">
      <slot />
    </div>
  </div>
</template>
