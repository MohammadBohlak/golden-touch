import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BackStack,
  EXIT_KEY,
  LAYER_KEY,
  TOP_KEY,
  entryKey,
  type BackLayer,
  type HistoryEntryState,
} from '../app/utils/back-stack.ts'

/** سجل متصفح مزيف: go() غير متزامن كالمتصفح، وpushState يقطع ما أمامه */
class FakeBrowser {
  entries: HistoryEntryState[]
  index: number
  /** أحداث popstate التي وصلت إلى الراوتر (لم نبتلعها) */
  routerPops: HistoryEntryState[] = []
  stack!: BackStack
  timers: Array<{ id: number; fn: () => void }> = []
  private timerSeq = 0
  exitRequests = 0
  exitFailures = 0

  constructor(entries: HistoryEntryState[], index = entries.length - 1) {
    this.entries = entries
    this.index = index
  }

  install(): this {
    this.stack = new BackStack(
      {
        state: () => this.entries[this.index] ?? null,
        push: (state) => {
          this.entries.splice(this.index + 1)
          this.entries.push(state)
          this.index++
        },
        replace: (state) => {
          this.entries[this.index] = state
        },
        go: (delta) => {
          queueMicrotask(() => {
            const target = this.index + delta
            if (target < 0 || target >= this.entries.length) return
            this.index = target
            const state = this.entries[target]!
            if (!this.stack.handlePopState(state)) this.routerPops.push(state)
          })
        },
      },
      {
        onExitRequest: () => this.exitRequests++,
        onExitFailed: () => this.exitFailures++,
      },
      {
        timers: {
          set: (fn) => {
            const id = ++this.timerSeq
            this.timers.push({ id, fn })
            return id
          },
          clear: (id) => {
            this.timers = this.timers.filter((t) => t.id !== id)
          },
        },
      },
    )
    this.stack.start()
    return this
  }

  get state(): HistoryEntryState {
    return this.entries[this.index]!
  }

  /** ما يعرضه الراوتر الآن */
  get location(): string {
    return String(this.state.current)
  }

  /** تنقل برمجي كما يفعله الراوتر: حارس ثم push */
  async routerPush(path: string): Promise<void> {
    await this.stack.prepareNavigation()
    const from = this.state
    this.entries[this.index] = { ...from, forward: path }
    this.entries.splice(this.index + 1)
    this.entries.push({
      back: from.current,
      current: path,
      forward: null,
      position: Number(from.position) + 1,
    })
    this.index++
    this.stack.onRouterNavigated()
  }

  /** ضغط زر الرجوع */
  async back(): Promise<void> {
    queueMicrotask(() => {
      const target = this.index - 1
      if (target < 0) return
      this.index = target
      const state = this.entries[target]!
      if (!this.stack.handlePopState(state)) {
        this.routerPops.push(state)
        this.stack.onRouterNavigated()
      }
    })
    await tick()
  }

  fireTimers(): void {
    const pending = this.timers.splice(0)
    for (const t of pending) t.fn()
  }
}

const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

function firstEntry(path = '/'): HistoryEntryState {
  return { back: null, current: path, forward: null, position: 0, scroll: null }
}

function layer(): BackLayer & { closed: number; busy: boolean } {
  const l = {
    closed: 0,
    busy: false,
    close() {
      l.closed++
    },
    canClose() {
      return !l.busy
    },
  }
  return l
}

describe('الحوارات وزر الرجوع', () => {
  it('فتح حوار يدفع مدخلاً بنفس مفتاح الصفحة', () => {
    const b = new FakeBrowser([firstEntry()]).install()
    b.stack.open(layer())
    assert.equal(b.entries.length, 2)
    assert.equal(b.state[LAYER_KEY], 1)
    assert.equal(entryKey(b.entries[0]), entryKey(b.entries[1]))
  })

  it('الرجوع يغلق الحوار ولا يراه الراوتر', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    const l = layer()
    b.stack.open(l)
    await b.back()
    assert.equal(l.closed, 1)
    assert.equal(b.stack.depth, 0)
    assert.equal(b.index, 0)
    assert.deepEqual(b.routerPops, [])
  })

  it('إغلاق الحوار بوسيلة أخرى يزيل مدخله دون تأثير على الراوتر', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    const l = layer()
    const handle = b.stack.open(l)
    handle.release()
    await tick()
    assert.equal(b.index, 0)
    assert.equal(l.closed, 0, 'لا يُستدعى close لحوار أُغلق أصلاً')
    assert.deepEqual(b.routerPops, [])
    handle.release() // آمنة للتكرار
    await tick()
    assert.equal(b.index, 0)
  })

  it('حوار فوق حوار: الرجوع يغلق الأعلى فقط', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    const sheet = layer()
    const confirm = layer()
    b.stack.open(sheet)
    b.stack.open(confirm)
    assert.equal(b.index, 2)
    await b.back()
    assert.equal(confirm.closed, 1)
    assert.equal(sheet.closed, 0)
    assert.equal(b.stack.depth, 1)
    await b.back()
    assert.equal(sheet.closed, 1)
    assert.equal(b.index, 0)
  })

  it('إغلاق حوارين متتاليين بالتتابع (تأكيد ثم الورقة) يرجع للصفحة فقط', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    const sheet = b.stack.open(layer())
    const confirm = b.stack.open(layer())
    confirm.release()
    sheet.release() // قبل وصول popstate الأول
    await tick()
    assert.equal(b.index, 0)
    assert.equal(b.stack.depth, 0)
    assert.deepEqual(b.routerPops, [])
  })

  it('إغلاق الحوار السفلي أولاً يؤجَّل مدخله حتى يُغلق الأعلى', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    const sheet = b.stack.open(layer())
    const confirm = b.stack.open(layer())
    sheet.release()
    await tick()
    assert.equal(b.index, 2, 'الأعلى ما زال مفتوحاً')
    confirm.release()
    await tick()
    assert.equal(b.index, 0)
  })

  it('حوار مشغول لا يُغلق بالرجوع ويبقى مدخله', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    const l = layer()
    l.busy = true
    b.stack.open(l)
    await b.back()
    assert.equal(l.closed, 0)
    assert.equal(b.stack.depth, 1)
    assert.equal(b.state[LAYER_KEY], 1)
    l.busy = false
    await b.back()
    assert.equal(l.closed, 1)
    assert.equal(b.index, 0)
  })

  it('فتح حوار أثناء رجوع جارٍ يُدفع بعد استقرار السجل', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    b.stack.open(layer()).release()
    const next = layer()
    b.stack.open(next) // popstate الأول لم يصل بعد
    assert.equal(b.index, 1, 'لم يُدفع بعد')
    await tick()
    assert.equal(b.index, 1)
    assert.equal(b.state[LAYER_KEY], 1)
    await b.back()
    assert.equal(next.closed, 1)
    assert.equal(b.index, 0)
  })
})

describe('التنقل البرمجي مع الحوارات', () => {
  it('تنقل أثناء حوار مفتوح يغلقه ويزيل مدخله قبل دفع الصفحة الجديدة', async () => {
    const b = new FakeBrowser([firstEntry('/customers')]).install()
    const l = layer()
    b.stack.open(l)
    await b.routerPush('/customers/1')
    assert.equal(l.closed, 1)
    assert.equal(b.location, '/customers/1')
    assert.equal(b.entries.length, 2, 'لا مدخل حوار عالق خلف الصفحة الجديدة')
    assert.equal(b.entries[0]![LAYER_KEY], undefined)
    // الرجوع يعود للصفحة السابقة وليس لمدخل حوار ميّت
    await b.back()
    assert.equal(b.location, '/customers')
    assert.equal(b.routerPops.length, 1)
  })

  it('إغلاق حوار ثم تنقل فوراً (حفظ ثم فتح الصفحة) لا يفسد السجل', async () => {
    const b = new FakeBrowser([firstEntry('/customers')]).install()
    const handle = b.stack.open(layer())
    handle.release()
    await b.routerPush('/customers/1')
    await tick()
    assert.equal(b.location, '/customers/1')
    assert.equal(b.entries.length, 2)
    assert.equal(b.index, 1)
  })

  it('دون حوارات لا ينتظر الحارس شيئاً', () => {
    const b = new FakeBrowser([firstEntry()]).install()
    assert.equal(b.stack.prepareNavigation(), undefined)
  })

  it('قفزة عبر عدة مدخلات إلى صفحة أخرى تغلق الحوار وتترك الراوتر يتنقل', async () => {
    const b = new FakeBrowser([firstEntry('/a')]).install()
    await b.routerPush('/b')
    const l = layer()
    b.stack.open(l)
    // المستخدم يقفز مدخلين للخلف (قائمة سجل المتصفح)
    queueMicrotask(() => {
      b.index = 0
      if (!b.stack.handlePopState(b.entries[0]!)) b.routerPops.push(b.entries[0]!)
    })
    await tick()
    assert.equal(l.closed, 1)
    assert.equal(b.routerPops.length, 1)
  })
})

describe('تحميل الصفحة على مدخل حوار قديم', () => {
  it('يرجع خطوة إلى مدخل الصفحة', async () => {
    const base = firstEntry()
    const b = new FakeBrowser([base, { ...base, [LAYER_KEY]: 1 }]).install()
    await tick()
    assert.equal(b.index, 0)
    assert.deepEqual(b.routerPops, [])
  })

  it('الرجوع للأمام إلى مدخل حوار غير موجود يتراجع عنه', async () => {
    const b = new FakeBrowser([firstEntry()]).install()
    b.stack.open(layer())
    await b.back()
    // زر «للأمام» في المتصفح
    queueMicrotask(() => {
      b.index = 1
      if (!b.stack.handlePopState(b.entries[1]!)) b.routerPops.push(b.entries[1]!)
    })
    await tick()
    assert.equal(b.index, 0)
    assert.equal(b.stack.depth, 0)
  })
})

describe('الخروج من التطبيق', () => {
  function armed(extra: HistoryEntryState[] = []) {
    const b = new FakeBrowser([...extra, firstEntry()]).install()
    b.index = extra.length
    assert.equal(b.stack.arm(), true)
    return b
  }

  it('الحارس: مدخل أول محروس ومدخل علوي منسوخ', () => {
    const b = armed()
    assert.equal(b.entries.length, 2)
    assert.equal(b.entries[0]![EXIT_KEY], true)
    assert.equal(b.entries[1]![TOP_KEY], true)
    assert.equal(b.index, 1)
    assert.equal(b.stack.arm(), false, 'لا يُوضع مرتين')
  })

  it('لا يُوضع الحارس بعد أول صفحة', async () => {
    const b = new FakeBrowser([firstEntry('/a')]).install()
    await b.routerPush('/b')
    assert.equal(b.stack.isArmable(), false)
  })

  it('رجوع من أول صفحة يعيد المستخدم ويطلب تأكيد الخروج', async () => {
    const b = armed()
    await b.back()
    assert.equal(b.exitRequests, 1)
    assert.equal(b.index, 1, 'بقي على الصفحة')
    assert.deepEqual(b.routerPops, [])
  })

  it('تأكيد الخروج يعود بحوار الخروج نفسه كطبقة: الرجوع يلغيه', async () => {
    const b = armed()
    await b.back()
    const l = layer()
    b.stack.open(l) // ما يفعله AppModal حين يُفتح حوار الخروج
    await b.back()
    assert.equal(l.closed, 1)
    assert.equal(b.exitRequests, 1)
    assert.equal(b.index, 1)
  })

  it('رجوع من صفحة ثانية يعود للأولى دون تأكيد، ثم الرجوع التالي يطلبه', async () => {
    const b = armed()
    await b.routerPush('/customers')
    await b.back()
    assert.equal(b.location, '/')
    assert.equal(b.exitRequests, 0)
    assert.equal(b.routerPops.length, 1)
    await b.back()
    assert.equal(b.exitRequests, 1)
    assert.equal(b.routerPops.length, 1, 'الراوتر لم يتحرك')
  })

  it('تأكيد الخروج مع وجود صفحة سابقة للموقع يغادر إليها', async () => {
    const b = armed([{ foreign: true }])
    await b.back()
    const l = layer()
    const handle = b.stack.open(l)
    b.stack.leaveApp()
    handle.release()
    await tick()
    assert.equal(b.index, 0, 'عاد إلى ما قبل الحارس')
    assert.equal(b.exitFailures, 0)
  })

  it('تأكيد الخروج دون صفحة سابقة: يفشل بعد المهلة ويُزال الحارس', async () => {
    const b = armed()
    await b.back()
    b.stack.open(layer())
    b.stack.leaveApp()
    await tick()
    assert.equal(b.index, 0, 'على الحارس')
    b.fireTimers()
    assert.equal(b.exitFailures, 1)
    assert.equal(b.state[EXIT_KEY], undefined)
    assert.equal(b.stack.isArmable(), false, 'لا يُعاد الحارس فوراً')
  })

  it('بعد فشل الخروج وتنقل المستخدم يمكن وضع الحارس من جديد', async () => {
    const b = armed()
    await b.back()
    b.stack.leaveApp()
    await tick()
    b.fireTimers()
    await b.routerPush('/x')
    await b.back()
    assert.equal(b.stack.isArmable(), true)
  })

  it('إعادة تحميل الصفحة وهي على الحارس تزيل علامته', () => {
    const base = firstEntry()
    const b = new FakeBrowser([{ ...base, [EXIT_KEY]: true }, { ...base, [TOP_KEY]: true }], 0)
    b.install()
    assert.equal(b.state[EXIT_KEY], undefined)
    assert.equal(b.stack.arm(), true)
    assert.equal(b.entries.length, 2)
  })
})
