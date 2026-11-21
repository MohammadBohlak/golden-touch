import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pushSupport, urlBase64ToUint8Array } from '../app/utils/push.ts'

describe('urlBase64ToUint8Array', () => {
  it('يفكّ base64url (- و_ وبلا حشو) إلى البايتات نفسها', () => {
    // [251, 255, 190] = "+/++" في base64 العادي = "-_--" في base64url
    assert.deepEqual([...urlBase64ToUint8Array('-_--')], [251, 255, 190])
    // "QQ" = "A" بعد إضافة الحشو "=="
    assert.deepEqual([...urlBase64ToUint8Array('QQ')], [65])
  })

  it('مفتاح VAPID العام بطول 65 بايتاً', () => {
    const key = Buffer.from(new Uint8Array(65).fill(4)).toString('base64url')
    assert.equal(urlBase64ToUint8Array(key).length, 65)
  })
})

describe('pushSupport', () => {
  const base = {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    isIos: false,
    isStandalone: false,
  }

  it('Android / سطح المكتب: مدعوم بلا تثبيت', () => {
    assert.equal(pushSupport(base), 'ok')
  })

  it('iPhone في Safari: يحتاج إضافة للشاشة الرئيسية', () => {
    assert.equal(
      pushSupport({ ...base, isIos: true, hasPushManager: false, hasNotification: false }),
      'needs-install',
    )
  })

  it('iPhone كتطبيق مضاف: مدعوم', () => {
    assert.equal(pushSupport({ ...base, isIos: true, isStandalone: true }), 'ok')
  })

  it('متصفح بلا Push: غير مدعوم', () => {
    assert.equal(pushSupport({ ...base, hasPushManager: false }), 'unsupported')
    assert.equal(pushSupport({ ...base, hasServiceWorker: false }), 'unsupported')
  })
})
