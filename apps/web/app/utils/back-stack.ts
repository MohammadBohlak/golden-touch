/**
 * زر الرجوع في الموبايل (وإيماءة الرجوع) مع الحوارات وبداية التطبيق.
 *
 * الفكرة: كل حوار مفتوح يدفع مدخلاً إلى سجل المتصفح بنفس رابط الصفحة (طبقة)، فيستهلكه زر الرجوع
 * بدل أن يغادر الصفحة، ونغلق الحوار. عند إغلاق الحوار بغير الرجوع (زر ×، حفظ…) نرجع خطوة لنزيل
 * مدخله. وفي أول صفحة من الجلسة نضع «حارساً» قبلها فيظهر تأكيد الخروج بدل مغادرة التطبيق.
 *
 * المدخلات التي نضيفها تنسخ حالة vue-router (current/position)، ونبتلع أحداث popstate الخاصة بها
 * (`handlePopState` تعيد true) كي لا يرى الراوتر تنقلاً لم يحدث. أي تنقل برمجي أثناء وجود طبقات
 * يمرّ أولاً بـ `prepareNavigation` فتُزال المدخلات قبل أن يدفع الراوتر مدخله.
 *
 * منطق نقي بلا اعتماديات Nuxt ولا DOM (منفذ History يُحقن) ليُختبر مباشرة (tests/back-stack.test.ts).
 */

export type HistoryEntryState = Record<string, unknown>

/** ما نحتاجه من window.history */
export interface HistoryPort {
  state(): HistoryEntryState | null
  push(state: HistoryEntryState): void
  replace(state: HistoryEntryState): void
  go(delta: number): void
}

export interface BackLayer {
  /** يغلق العنصر (يُستدعى عند الرجوع) */
  close(): void
  /** false ⇐ الرجوع لا يغلقه (حوار مشغول بالحفظ) فيبقى مفتوحاً */
  canClose?(): boolean
}

export interface BackLayerHandle {
  /** العنصر أُغلق بوسيلة أخرى: أزل مدخله من السجل (آمنة للتكرار) */
  release(): void
}

export interface BackStackHooks {
  /** ضغط المستخدم رجوعاً في أول صفحة: اعرض تأكيد الخروج */
  onExitRequest(): void
  /** أكّد الخروج لكن المتصفح لم يغادر (لا صفحة سابقة يمكن الرجوع إليها برمجياً) */
  onExitFailed(): void
}

export interface BackStackTimers {
  set(callback: () => void, ms: number): unknown
  clear(id: unknown): void
}

export const LAYER_KEY = '__gtLayer'
export const EXIT_KEY = '__gtExit'
export const TOP_KEY = '__gtTop'

interface Entry {
  layer: BackLayer
  released: boolean
}

type Leaving = 'none' | 'toGuard' | 'beyond'

/** مفتاح مدخل الراوتر: المدخلات المنسوخة (طبقات/حارس/قمة) تشترك في مفتاح واحد */
export function entryKey(state: HistoryEntryState | null | undefined): string | null {
  if (!state || typeof state.current !== 'string') return null
  return `${state.current}|${String(state.position)}`
}

function withoutMarkers(state: HistoryEntryState | null | undefined): HistoryEntryState {
  const { [LAYER_KEY]: _layer, [EXIT_KEY]: _exit, [TOP_KEY]: _top, ...rest } = state ?? {}
  return rest
}

const defaultTimers: BackStackTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}

export class BackStack {
  private readonly port: HistoryPort
  private readonly hooks: BackStackHooks
  private readonly timers: BackStackTimers
  private readonly traverseTimeout: number
  private readonly leaveTimeout: number

  /** طبقات مدخلاتها موجودة فعلاً في السجل، من الأقدم للأحدث */
  private layers: Entry[] = []
  /** طبقات فُتحت أثناء رجوع جارٍ؛ تُدفع حين يستقر السجل */
  private deferred: Entry[] = []
  private currentKey: string | null = null
  private traversing = false
  private timer: unknown = null
  private pendingPops = 0
  private waiters: Array<() => void> = []
  private exitPending = false
  private leaving: Leaving = 'none'
  private armSuppressed = false

  constructor(
    port: HistoryPort,
    hooks: BackStackHooks,
    options: { timers?: BackStackTimers; traverseTimeout?: number; leaveTimeout?: number } = {},
  ) {
    this.port = port
    this.hooks = hooks
    this.timers = options.timers ?? defaultTimers
    this.traverseTimeout = options.traverseTimeout ?? 800
    this.leaveTimeout = options.leaveTimeout ?? 1200
  }

  /** عدد الطبقات المفتوحة (للاختبار والتشخيص) */
  get depth(): number {
    return this.layers.length
  }

  /** تهيئة عند تحميل الصفحة: إصلاح مدخلات متروكة من جلسة سابقة (تحديث الصفحة وهي مفتوحة على حوار) */
  start(): void {
    const state = this.port.state()
    this.currentKey = entryKey(state)
    if (!state) return
    const stale = Number(state[LAYER_KEY] ?? 0)
    if (stale > 0) {
      // حُمّلت الصفحة على مدخل حوار لم يعد موجوداً: نرجع إلى مدخل الصفحة نفسها
      this.beginTraversal()
      this.port.go(-stale)
      return
    }
    if (state[EXIT_KEY]) this.port.replace(withoutMarkers(state))
  }

  /** هل يمكن وضع الحارس الآن؟ (أول مدخل للراوتر وغير محروس) */
  isArmable(): boolean {
    if (this.armSuppressed) return false
    const state = this.port.state()
    return !!state && state.back === null && !state[TOP_KEY] && !state[EXIT_KEY] && !state[LAYER_KEY]
  }

  /**
   * يضع الحارس: المدخل الحالي (الأول) يصبح حارساً، ونكرره مدخلاً علوياً يعمل الراوتر عليه.
   * يجب أن يُستدعى بعد نشاط من المستخدم (Chrome يتجاوز المدخلات المضافة بلا نشاط عند الرجوع).
   */
  arm(): boolean {
    if (this.layers.length || this.deferred.length || this.traversing || this.pendingPops) return false
    if (this.leaving !== 'none' || !this.isArmable()) return false
    const state = this.port.state()!
    this.port.replace({ ...state, [EXIT_KEY]: true })
    this.port.push({ ...state, [TOP_KEY]: true })
    return true
  }

  /** يُستدعى بعد كل تنقل ناجح للراوتر */
  onRouterNavigated(): void {
    this.currentKey = entryKey(this.port.state())
    this.armSuppressed = false
  }

  /** يفتح طبقة: يدفع مدخلاً للسجل (أو يؤجله إن كان هناك رجوع جارٍ) */
  open(layer: BackLayer): BackLayerHandle {
    const entry: Entry = { layer, released: false }
    if (this.busy()) this.deferred.push(entry)
    else this.pushLayer(entry)
    return { release: () => this.release(entry) }
  }

  /**
   * يُستدعى من مستمع popstate (فترة الالتقاط). true ⇐ الحدث يخصّنا فيجب إيقاف انتشاره.
   * @param state حالة المدخل الذي وصلنا إليه
   */
  handlePopState(state: HistoryEntryState | null): boolean {
    if (this.traversing) this.endTraversal()

    if (state?.[EXIT_KEY]) return this.onGuard()

    const key = entryKey(state)
    if (key === null || key !== this.currentKey) {
      // انتقال إلى صفحة أخرى: الراوتر يتولاه، والطبقات كانت تخصّ الصفحة السابقة
      this.currentKey = key
      this.leaving = 'none'
      this.exitPending = false
      this.dropLayers()
      this.settleIfIdle()
      return false
    }

    if (this.leaving === 'toGuard') this.leaving = 'none'
    this.syncDepth(Number(state?.[LAYER_KEY] ?? 0), state)
    this.drain()
    this.settleIfIdle()
    if (this.exitPending && !this.busy()) {
      this.exitPending = false
      this.hooks.onExitRequest()
    }
    return true
  }

  /**
   * حارس التنقل البرمجي: يغلق الطبقات المفتوحة ويزيل مدخلاتها قبل أن يدفع الراوتر مدخله.
   * يعيد undefined (فوراً) حين لا شيء معلّق.
   */
  prepareNavigation(): Promise<void> | undefined {
    if (!this.layers.length && !this.deferred.length && !this.busy()) return undefined
    for (const entry of this.deferred.splice(0)) entry.released = true
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const entry = this.layers[i]!
      if (entry.released) continue
      entry.released = true
      entry.layer.close()
    }
    this.flush()
    return this.whenSettled()
  }

  /** المستخدم أكّد الخروج: نعود إلى الحارس ثم خطوة أخيرة تغادر الصفحة إن وُجد ما قبلها */
  leaveApp(): void {
    const run = () => {
      const depth = this.layers.length
      for (const entry of this.layers.splice(0)) entry.released = true
      for (const entry of this.deferred.splice(0)) entry.released = true
      this.exitPending = false
      this.leaving = 'toGuard'
      this.beginTraversal(this.leaveTimeout)
      this.port.go(-(depth + 1))
    }
    if (this.busy()) void this.whenSettled().then(run)
    else run()
  }

  private busy(): boolean {
    return this.traversing || this.pendingPops > 0
  }

  private pushLayer(entry: Entry): void {
    this.layers.push(entry)
    this.port.push({ ...withoutMarkers(this.port.state()), [LAYER_KEY]: this.layers.length })
  }

  private release(entry: Entry): void {
    if (entry.released) return
    entry.released = true
    const i = this.deferred.indexOf(entry)
    if (i >= 0) {
      this.deferred.splice(i, 1)
      return
    }
    this.flush()
  }

  /** يرجع خطوات بعدد الطبقات المحرَّرة في القمة (المحرَّرة تحت طبقة مفتوحة تنتظر دورها) */
  private flush(): void {
    let count = 0
    while (this.layers.length && this.layers[this.layers.length - 1]!.released) {
      this.layers.pop()
      count++
    }
    if (count) {
      this.pendingPops += count
      this.drain()
    }
  }

  private drain(): void {
    if (this.traversing || this.pendingPops === 0) return
    const count = this.pendingPops
    this.pendingPops = 0
    this.beginTraversal()
    this.port.go(-count)
  }

  private beginTraversal(timeout = this.traverseTimeout): void {
    this.traversing = true
    if (this.timer !== null) this.timers.clear(this.timer)
    this.timer = this.timers.set(() => {
      this.timer = null
      if (!this.traversing) return
      this.traversing = false
      if (this.leaving !== 'none') this.failLeave()
      else {
        // لم يصل popstate (رجوع تجاوز البداية مثلاً): لا نعلق
        this.drain()
        this.settleIfIdle()
      }
    }, timeout)
  }

  private endTraversal(): void {
    this.traversing = false
    if (this.timer !== null) this.timers.clear(this.timer)
    this.timer = null
  }

  /** المستخدم على مدخل نفس الصفحة بعمق `depth`: نغلق ما فوقه */
  private syncDepth(depth: number, state: HistoryEntryState | null): void {
    while (this.layers.length > depth) {
      const top = this.layers[this.layers.length - 1]!
      if (!top.released && top.layer.canClose && !top.layer.canClose()) {
        // مشغول (حفظ جارٍ): نعيد المدخلات التي استُهلكت ليبقى مفتوحاً
        const base = withoutMarkers(state)
        for (let d = depth + 1; d <= this.layers.length; d++) {
          this.port.push({ ...base, [LAYER_KEY]: d })
        }
        return
      }
      this.layers.pop()
      if (!top.released) {
        top.released = true
        top.layer.close()
      }
    }
    // مدخلات طبقات قديمة أمامنا (رجوع للأمام): نتراجع عنها. ما حُرِّر وينتظر دوره محسوب أصلاً.
    const expected = this.layers.length + this.pendingPops
    if (depth > expected) this.pendingPops += depth - expected
    this.flush()
  }

  /** نصل إلى الحارس: إمّا بداية الخروج الفعلي، أو المستخدم ضغط رجوعاً من أول صفحة */
  private onGuard(): boolean {
    this.dropLayers()
    if (this.leaving === 'toGuard') {
      this.leaving = 'beyond'
      this.beginTraversal(this.leaveTimeout)
      this.port.go(-1)
      return true
    }
    this.leaving = 'none'
    this.exitPending = true
    this.beginTraversal()
    this.port.go(1)
    return true
  }

  /** أُكّد الخروج لكن الصفحة ما زالت حيّة: نزيل الحارس ليخرج الرجوع التالي بالنظام */
  private failLeave(): void {
    this.leaving = 'none'
    this.armSuppressed = true
    this.port.replace(withoutMarkers(this.port.state()))
    this.hooks.onExitFailed()
    this.settleIfIdle()
  }

  /** الراوتر يتولى الانتقال أو نحن على الحارس: كل الطبقات تُغلق دون لمس السجل */
  private dropLayers(): void {
    this.pendingPops = 0
    for (const entry of this.deferred.splice(0)) entry.released = true
    for (const entry of this.layers.splice(0)) {
      if (entry.released) continue
      entry.released = true
      entry.layer.close()
    }
  }

  private whenSettled(): Promise<void> {
    if (!this.busy()) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  private settleIfIdle(): void {
    if (this.busy()) return
    for (const entry of this.deferred.splice(0)) {
      if (!entry.released) this.pushLayer(entry)
    }
    for (const resolve of this.waiters.splice(0)) resolve()
  }
}

// ── نسخة التطبيق الوحيدة (تُنشأ في plugins/00.back-navigation.client.ts) ──

let instance: BackStack | null = null

export function installBackStack(stack: BackStack | null): void {
  instance = stack
}

/** يسجّل عنصراً تراكبياً (حوار) يغلقه زر الرجوع. على الخادم أو قبل التركيب: لا شيء */
export function openBackLayer(layer: BackLayer): BackLayerHandle {
  return instance?.open(layer) ?? { release: () => {} }
}

/** تأكيد الخروج من التطبيق (انظر ExitConfirmDialog) */
export function leaveApp(): void {
  instance?.leaveApp()
}
