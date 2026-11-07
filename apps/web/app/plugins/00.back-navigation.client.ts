import { BackStack, installBackStack } from '~/utils/back-stack'

type GateWindow = Window & {
  __gtPopGate?: (event: PopStateEvent) => boolean
  __gtPopGateReady?: boolean
}

/**
 * زر الرجوع في الموبايل: يغلق الحوار المفتوح بدل مغادرة الصفحة، وفي أول صفحة يطلب تأكيد الخروج.
 * المنطق كله في utils/back-stack.ts؛ هنا الربط بـ window.history وvue-router فقط.
 *
 * إيقاف popstate عن vue-router يتم عبر «بوّابة» مضمَّنة في الـ head (انظر POPSTATE_GATE في
 * nuxt.config.ts) لأن مستمع الراوتر يُسجَّل قبل أي إضافة ويعمل قبل أي مستمع آخر على window.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()
  const exitOpen = useState('exit-prompt', () => false)
  const toast = useToast()
  const gateWindow = window as GateWindow

  const stack = new BackStack(
    {
      state: () => (history.state as Record<string, unknown> | null) ?? null,
      push: (state) => history.pushState(state, ''),
      replace: (state) => history.replaceState(state, ''),
      go: (delta) => history.go(delta),
    },
    {
      onExitRequest: () => {
        exitOpen.value = true
      },
      onExitFailed: () => {
        exitOpen.value = false
        // لا يمكن إغلاق نافذة المتصفح برمجياً: الرجوع التالي بالنظام يُغلقه
        toast.info('اضغط رجوع مرة أخرى للخروج', { duration: 5000 })
      },
    },
  )
  installBackStack(stack)
  stack.start()

  const onPopState = (event: PopStateEvent) =>
    stack.handlePopState((event.state as Record<string, unknown> | null) ?? null)

  if (gateWindow.__gtPopGateReady) {
    gateWindow.__gtPopGate = onPopState
  } else {
    // احتياط (السكربت المضمَّن غائب): التقاط مبكر يكفي حين يعمل قبل مستمع الراوتر
    window.addEventListener(
      'popstate',
      (event) => {
        if (onPopState(event)) event.stopImmediatePropagation()
      },
      { capture: true },
    )
  }

  router.beforeEach(() => stack.prepareNavigation())
  router.afterEach(() => {
    stack.onRouterNavigated()
    armAfterInteraction()
  })

  /**
   * Chrome يتجاوز عند الرجوع أي مدخل أُضيف بلا تفاعل من المستخدم، فنؤجّل وضع الحارس
   * إلى أول نقرة/ضغطة مفتاح (يكفي نشاط واحد في عمر الصفحة).
   */
  let waiting = false
  function armAfterInteraction() {
    if (waiting || !stack.isArmable()) return
    waiting = true
    const events = ['click', 'keydown'] as const
    const onInteract = () => {
      for (const name of events) window.removeEventListener(name, onInteract, true)
      waiting = false
      setTimeout(() => {
        const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
          .userActivation
        if (activation && !activation.hasBeenActive) armAfterInteraction()
        else stack.arm()
      })
    }
    for (const name of events) window.addEventListener(name, onInteract, true)
  }

  router.isReady().then(armAfterInteraction, () => {})
})
