<script setup lang="ts">
/**
 * حوار متجاوب: ورقة سفلية (bottom sheet) على الموبايل، ونافذة وسطية على الشاشات الأكبر.
 * يغلق بـ Esc أو بالنقر على الخلفية، يقفل تمرير الصفحة، ويعيد التركيز للعنصر السابق.
 */
const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
    /** يمنع الإغلاق بالخلفية/Esc (أثناء الحفظ مثلاً) */
    persistent?: boolean
  }>(),
  { title: undefined, description: undefined, size: 'md' },
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

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    close()
  }
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    previouslyFocused = document.activeElement as HTMLElement | null
    document.documentElement.style.overflow = 'hidden'
    await nextTick()
    const target =
      panel.value?.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? panel.value
    target?.focus({ preventScroll: true })
  } else {
    document.documentElement.style.overflow = ''
    previouslyFocused?.focus?.({ preventScroll: true })
  }
})

onBeforeUnmount(() => {
  if (import.meta.client && open.value) document.documentElement.style.overflow = ''
})

const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/55 backdrop-blur-[2px] sm:items-center sm:p-6"
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
              'flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden bg-surface shadow-float outline-none',
              'rounded-t-3xl sm:rounded-3xl',
              widths[size],
            )
          "
        >
          <!-- مقبض بصري للورقة السفلية -->
          <div class="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
            <span class="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>

          <header
            v-if="title || $slots.header"
            class="flex items-start gap-3 px-5 pt-3 pb-2 sm:pt-5"
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
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <slot name="footer" />
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
