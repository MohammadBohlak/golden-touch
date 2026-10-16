<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { IconName } from '~/utils/icons'

defineOptions({ inheritAttrs: false })

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger' | 'danger-soft' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    to?: RouteLocationRaw
    href?: string
    loading?: boolean
    disabled?: boolean
    block?: boolean
    icon?: IconName
    iconEnd?: IconName
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    to: undefined,
    href: undefined,
    icon: undefined,
    iconEnd: undefined,
  },
)

const attrs = useAttrs()

const variants: Record<Variant, string> = {
  primary: 'bg-ink-950 text-white hover:bg-ink-800 active:bg-ink-700',
  gold: 'bg-gold-300 text-ink-950 hover:bg-gold-400 active:bg-gold-500 shadow-gold',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-muted active:bg-line',
  ghost: 'bg-transparent text-fg hover:bg-surface-muted active:bg-line',
  danger: 'bg-danger text-white hover:bg-red-800 active:bg-red-900',
  'danger-soft': 'bg-danger-soft text-danger hover:bg-red-100 active:bg-red-200',
  success: 'bg-success text-white hover:bg-green-800 active:bg-green-900',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-13 px-5 text-base gap-2 rounded-2xl',
  icon: 'size-11 rounded-xl',
  'icon-sm': 'size-9 rounded-lg',
}

const isDisabled = computed(() => props.disabled || props.loading)
const component = computed(() => (props.to || props.href ? resolveComponent('NuxtLink') : 'button'))
const iconSize = computed(() => (props.size === 'sm' || props.size === 'icon-sm' ? 16 : 20))

const classes = computed(() =>
  cn(
    'relative inline-flex items-center justify-center font-semibold whitespace-nowrap select-none',
    'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    variants[props.variant],
    sizes[props.size],
    props.block && 'w-full',
    attrs.class as string,
  ),
)

const bindings = computed(() => {
  const { class: _class, ...rest } = attrs
  if (component.value === 'button') {
    return {
      ...rest,
      type: props.type,
      disabled: isDisabled.value,
      'aria-busy': props.loading || undefined,
    }
  }
  return {
    ...rest,
    to: props.to ?? props.href,
    'aria-disabled': isDisabled.value || undefined,
    tabindex: isDisabled.value ? -1 : undefined,
  }
})
</script>

<template>
  <component :is="component" :class="classes" v-bind="bindings">
    <AppSpinner v-if="loading" :size="iconSize" />
    <AppIcon v-else-if="icon" :name="icon" :size="iconSize" />
    <slot />
    <AppIcon v-if="iconEnd && !loading" :name="iconEnd" :size="iconSize" />
  </component>
</template>
