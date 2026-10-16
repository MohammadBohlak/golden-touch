import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatDuration,
  formatMoney,
  parseInteger,
  percentChange,
  toInternationalPhone,
  toLatinDigits,
} from '../app/utils/format.ts'

describe('format utils', () => {
  it('formats Syrian pound amounts', () => {
    assert.equal(formatMoney(25000), '25,000 ل.س')
    assert.equal(formatMoney(null), '0 ل.س')
  })

  it('parses Arabic-Indic digits from mobile keyboards', () => {
    assert.equal(toLatinDigits('٢٥٠٠٠'), '25000')
    assert.equal(parseInteger('٢٥,٠٠٠'), 25000)
    assert.equal(parseInteger(''), null)
  })

  it('formats durations in natural Arabic', () => {
    assert.equal(formatDuration(45), '45 دقيقة')
    assert.equal(formatDuration(60), 'ساعة')
    assert.equal(formatDuration(90), 'ساعة و30 د')
    assert.equal(formatDuration(120), 'ساعتان')
  })

  it('computes percent change', () => {
    assert.equal(percentChange(150, 100), 50)
    assert.equal(percentChange(0, 0), 0)
    assert.equal(percentChange(10, 0), null)
  })

  it('converts local phones for WhatsApp', () => {
    assert.equal(toInternationalPhone('0991 234 567'), '963991234567')
    assert.equal(toInternationalPhone('+963991234567'), '963991234567')
  })
})
