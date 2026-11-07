<script setup lang="ts">
/**
 * حوار متجاوب: ورقة سفلية (bottom sheet) على الموبايل، ونافذة وسطية على الشاشات الأكبر.
 * يغلق بـ Esc أو بالنقر على الخلفية أو بسحب الورقة لأسفل (موبايل)، يقفل تمرير الصفحة،
 * ويعيد التركيز للعنصر السابق. الدخول والخروج بحركة (CSS: .modal-* في main.css).
 *
 * footerKey: غيّره عند تبدّل مجموعة أزرار التذييل (وضع آخر) فتتبدّل بتلاشٍ وبحركة ارتفاع.
 */
const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
    /** يمنع الإغلاق بالخلفية/Esc/السحب (أثناء الحفظ مثلاً) */
    persistent?: boolean
    footerKey?: string | number
  }>(),
  { title: undefined, description: undefined, size: 'md', footerKey: undefined },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement>()
const titleId = useId()
let previouslyFocused: HTMLElement | null = null

function close() {
  if (props.persistent) return
  open.value = false
  emit('close')
}

const { handlers: dragHandlers } = useSheetDrag({
  panel,
  enabled: () => !props.persistent,
  onDismiss: close,
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
  }
}

/** قفل التمرير بعدّاد مشترك بين الحوارات (انظر utils/scroll-lock.ts) */
let releaseScroll: (() => void) | null = null

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    previouslyFocused = document.activeElement as HTMLElement | null
    releaseScroll ??= acquireScrollLock()
    await nextTick()
    const target =
      panel.value?.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? panel.value
    target?.focus({ preventScroll: true })
  } else {
    releaseScroll?.()
    releaseScroll = null
    previouslyFocused?.focus?.({ preventScroll: true })
  }
})

onBeforeUnmount(() => {
  releaseScroll?.()
})

const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" :duration="{ enter: MOTION.slow, leave: exitDuration(MOTION.slow) }">
      <div
        v-if="open"
        class="modal-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
        @click.self="close"
        @keydown="onKeydown"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
          :class="
            cn(
              'modal-panel flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface shadow-float outline-none',
              'rounded-t-3xl sm:rounded-3xl',
              widths[size],
            )
          "
        >
          <!-- مقبض بصري للورقة السفلية، ومنطقة سحب للإغلاق -->
          <div
            class="flex touch-none justify-center pt-2.5 pb-1 sm:hidden"
            aria-hidden="true"
            v-bind="dragHandlers"
          >
            <span class="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>

          <header
            v-if="title || $slots.header"
            class="flex touch-none items-start gap-3 px-5 pt-2 pb-2 sm:touch-auto sm:pt-5"
            v-bind="dragHandlers"
          >
            <div class="min-w-0 flex-1">
              <slot name="header">
                <h2 :id="titleId" class="text-lg leading-snug font-bold">{{ title }}</h2>
                <p v-if="description" class="mt-0.5 text-sm text-fg-muted">{{ description }}</p>
              </slot>
            </div>
            <AppButton
              v-if="!persistent"
              variant="ghost"
              size="icon-sm"
              class="-me-1.5 shrink-0"
              aria-label="إغلاق"
              icon="x"
              @click="close"
            />
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-5">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4"
          >
            <AutoHeight bleed="-m-3 p-3">
              <Transition name="fade" mode="out-in">
                <div
                  :key="footerKey"
                  class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
                >
                  <slot name="footer" />
                </div>
              </Transition>
            </AutoHeight>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
