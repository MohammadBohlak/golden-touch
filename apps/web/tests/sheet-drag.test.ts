import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dragProgress, shouldDismissSheet, shouldDismissSwipe } from '../app/utils/sheet-drag.ts'

describe('shouldDismissSheet', () => {
  it('يغلق عند تجاوز 30% من الارتفاع', () => {
    assert.equal(shouldDismissSheet(300, 1000, 0), true)
    assert.equal(shouldDismissSheet(299, 1000, 0), false)
  })

  it('يغلق عند القذف السريع بعد مسافة دنيا', () => {
    assert.equal(shouldDismissSheet(60, 1000, 0.8), true)
    assert.equal(shouldDismissSheet(20, 1000, 2), false)
  })

  it('لا يغلق بحركة صاعدة أو ارتفاع غير صالح', () => {
    assert.equal(shouldDismissSheet(-50, 1000, 3), false)
    assert.equal(shouldDismissSheet(100, 0, 3), false)
  })
})

describe('dragProgress', () => {
  it('يحصر النسبة بين 0 و1', () => {
    assert.equal(dragProgress(-10, 100), 0)
    assert.equal(dragProgress(50, 100), 0.5)
    assert.equal(dragProgress(500, 100), 1)
    assert.equal(dragProgress(10, 0), 0)
  })
})

describe('shouldDismissSwipe', () => {
  it('يغلق عند ثلث العرض في أي اتجاه', () => {
    assert.equal(shouldDismissSwipe(-140, 400, 0), true)
    assert.equal(shouldDismissSwipe(140, 400, 0), true)
    assert.equal(shouldDismissSwipe(100, 400, 0), false)
  })

  it('القذف يجب أن يوافق اتجاه السحب', () => {
    assert.equal(shouldDismissSwipe(40, 400, 0.9), true)
    assert.equal(shouldDismissSwipe(40, 400, -0.9), false)
    assert.equal(shouldDismissSwipe(10, 400, 3), false)
  })
})
