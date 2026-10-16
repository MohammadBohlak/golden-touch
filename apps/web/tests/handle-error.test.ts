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

  it('detects network failures and aborts', () => {
    assert.equal(toApiError({ name: 'FetchError', message: 'fetch failed' }).status, 0)
    assert.equal(toApiError({ name: 'AbortError' }).aborted, true)
  })
})
