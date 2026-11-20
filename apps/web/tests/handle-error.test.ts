import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fieldErrors, toApiError } from '../app/utils/handle-error.ts'

describe('toApiError', () => {
  it('keeps Arabic server messages and field errors', () => {
    const error = toApiError({
      response: {
        status: 409,
        _data: { message: 'هذا الوقت يتداخل مع حجز آخر', errors: { startAt: ['متداخل'] } },
      },
    })
    assert.equal(error.status, 409)
    assert.equal(error.message, 'هذا الوقت يتداخل مع حجز آخر')
    assert.deepEqual(fieldErrors(error), { startAt: 'متداخل' })
  })

  it('translates English/unknown messages by status', () => {
    assert.equal(
      toApiError({ response: { status: 403, _data: { message: 'Forbidden' } } }).message,
      'ليس لديك صلاحية للقيام بهذا الإجراء',
    )
  })

  it('keeps code and data (PHONE_DUPLICATE) and omits them otherwise', () => {
    const data = { customers: [{ id: 'c1', name: 'أبو أحمد' }] }
    const dup = toApiError({
      response: {
        status: 409,
        _data: { message: 'رقم الهاتف مسجّل مسبقاً للزبون "أبو أحمد"', code: 'PHONE_DUPLICATE', data },
      },
    })
    assert.equal(dup.code, 'PHONE_DUPLICATE')
    assert.deepEqual(dup.data, data)
    const plain = toApiError({ response: { status: 409, _data: { message: 'تعارض' } } })
    assert.equal('code' in plain, false)
    assert.equal('data' in plain, false)
  })

  it('detects network failures and aborts', () => {
    assert.equal(toApiError({ name: 'FetchError', message: 'fetch failed' }).status, 0)
    assert.equal(toApiError({ name: 'AbortError' }).aborted, true)
  })
})
