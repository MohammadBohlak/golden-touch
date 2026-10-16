export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  message: string
  actionLabel?: string
}

interface ToastOptions {
  /** بالميلي ثانية — افتراضياً 4 ثوانٍ (6 للأخطاء) */
  duration?: number
  action?: { label: string; handler: () => void }
}

let seed = 0
const handlers = new Map<number, () => void>()

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
    handlers.delete(id)
  }

  function push(tone: ToastTone, message: string, options: ToastOptions = {}): number {
    const id = ++seed
    if (options.action) handlers.set(id, options.action.handler)
    // نُبقي 3 رسائل كحد أقصى حتى لا تغطي الشاشة
    toasts.value = [
      ...toasts.value.slice(-2),
      { id, tone, message, actionLabel: options.action?.label },
    ]
    if (import.meta.client) {
      setTimeout(() => dismiss(id), options.duration ?? (tone === 'error' ? 6000 : 4000))
    }
    return id
  }

  function runAction(id: number): void {
    handlers.get(id)?.()
    dismiss(id)
  }

  return {
    toasts,
    dismiss,
    runAction,
    success: (message: string, options?: ToastOptions) => push('success', message, options),
    error: (message: string, options?: ToastOptions) => push('error', message, options),
    info: (message: string, options?: ToastOptions) => push('info', message, options),
  }
}
