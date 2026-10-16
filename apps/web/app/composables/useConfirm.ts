export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions
}

let resolver: ((value: boolean) => void) | null = null

/** حوار تأكيد عام: `if (await confirm({ title: '…' })) …` — يُعرض عبر ConfirmDialog في التخطيط */
export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog', () => ({
    open: false,
    options: { title: '' },
  }))

  function confirm(options: ConfirmOptions): Promise<boolean> {
    resolver?.(false)
    state.value = { open: true, options }
    return new Promise((resolve) => {
      resolver = resolve
    })
  }

  function settle(value: boolean): void {
    state.value = { ...state.value, open: false }
    resolver?.(value)
    resolver = null
  }

  return { state, confirm, settle }
}
