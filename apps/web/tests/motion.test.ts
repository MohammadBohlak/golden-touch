import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  EASING,
  EXIT_RATIO,
  MOTION,
  exitDuration,
  easeOutCubic,
  prefersReducedMotion,
  tweenValue,
} from '../app/utils/motion.ts'

const css = readFileSync(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')

/** قيمة متغيّر CSS معرّف في main.css (أول تعريف) */
function cssVar(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`))
  assert.ok(match, `المتغيّر ${name} غير معرّف في main.css`)
  return match[1]!.trim()
}

describe('motion tokens', () => {
  it('مدد الدخول في CSS تطابق الشيفرة', () => {
    for (const [key, ms] of Object.entries(MOTION)) {
      assert.equal(cssVar(`--motion-${key}`), `${ms}ms`, `--motion-${key}`)
    }
  })

  it('مدد الخروج في CSS = round(الدخول × النسبة)', () => {
    for (const [key, ms] of Object.entries(MOTION)) {
      assert.equal(cssVar(`--motion-${key}-exit`), `${exitDuration(ms)}ms`, `--motion-${key}-exit`)
    }
  })

  it('المنحنيات في CSS تطابق الشيفرة', () => {
    assert.equal(cssVar('--ease-out-soft'), EASING.out)
    assert.equal(cssVar('--ease-in-soft'), EASING.in)
    assert.equal(cssVar('--ease-in-out-soft'), EASING.inOut)
    assert.equal(cssVar('--ease-spring'), EASING.spring)
  })

  it('الخروج أسرع من الدخول دائماً', () => {
    for (const ms of Object.values(MOTION)) assert.ok(exitDuration(ms) < ms)
    assert.equal(exitDuration(200), Math.round(200 * EXIT_RATIO))
  })

  it('prefersReducedMotion آمن خارج المتصفح', () => {
    assert.equal(prefersReducedMotion(), false)
  })
})

describe('سياسة تقليل الحركة', () => {
  it('لا تُوقف مؤشر التحميل الدوّار', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    assert.match(block, /\.animate-spin\s*\{[^}]*animation-iteration-count:\s*infinite/)
  })

  it('تصفّر مسافات الإزاحة', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    assert.match(block, /--motion-distance:\s*0/)
  })
})

describe('tweenValue', () => {
  it('يبدأ من القيمة الأولى وينتهي بالأخيرة تماماً', () => {
    assert.equal(tweenValue(0, 1500, 0), 0)
    assert.equal(tweenValue(0, 1500, 1), 1500)
    assert.equal(tweenValue(200, 80, 1.4), 80)
  })

  it('الأعداد الصحيحة تبقى صحيحة وأحادية الاتجاه', () => {
    let last = 0
    for (let i = 0; i <= 20; i++) {
      const v = tweenValue(0, 1000, i / 20)
      assert.ok(Number.isInteger(v))
      assert.ok(v >= last)
      last = v
    }
  })

  it('يدعم التناقص والقيم العشرية', () => {
    assert.ok(tweenValue(100, 0, 0.5) < 100)
    assert.notEqual(tweenValue(0, 12.5, 0.5), Math.round(tweenValue(0, 12.5, 0.5)))
  })

  it('easeOutCubic يحصر المدخل', () => {
    assert.equal(easeOutCubic(-1), 0)
    assert.equal(easeOutCubic(2), 1)
    assert.ok(easeOutCubic(0.5) > 0.5)
  })
})
