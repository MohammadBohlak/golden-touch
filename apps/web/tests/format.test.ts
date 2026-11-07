import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatDuration,
  formatMoney,
  parseInteger,
  percentChange,
  toInternationalPhone,
  toLocalPhone,
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

describe('toLocalPhone', () => {
  it('يحوّل الأرقام السورية الدولية إلى الصيغة المحلية', () => {
    assert.equal(toLocalPhone('+963 944 123 456'), '0944123456')
    assert.equal(toLocalPhone('00963944123456'), '0944123456')
    assert.equal(toLocalPhone('963944123456'), '0944123456')
    assert.equal(toLocalPhone('+963 (0) 944-123-456'), '0944123456')
  })

  it('يبقي المحلية كما هي ويزيل الرموز والأرقام العربية', () => {
    assert.equal(toLocalPhone('0944 123 456'), '0944123456')
    assert.equal(toLocalPhone('٠٩٤٤١٢٣٤٥٦'), '0944123456')
  })

  it('يحتفظ بالرموز الدولية غير السورية', () => {
    assert.equal(toLocalPhone('+90 532 111 22 33'), '+905321112233')
  })

  it('يرفض ما لا يصلح رقماً', () => {
    assert.equal(toLocalPhone('abc'), null)
    assert.equal(toLocalPhone('123'), null)
    assert.equal(toLocalPhone('+963'), null)
  })
})
