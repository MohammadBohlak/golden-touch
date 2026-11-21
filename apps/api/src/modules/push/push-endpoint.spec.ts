import { isAllowedPushEndpoint } from './push-endpoint'

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QWxhZGRpbg',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('يقبل %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true)
  })

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc', // ليس https
    'https://fcm.googleapis.com.evil.example/x', // مضيف مموَّه
    'https://evil.example/fcm.googleapis.com',
    'https://notpush.apple.com.evil.io/x',
    'https://evilpush.apple.com/x', // لاحقة بلا نقطة فاصلة
    'https://fcm.googleapis.com:8443/x', // منفذ غير قياسي
    'https://user:pass@fcm.googleapis.com/x',
    'https://127.0.0.1/x',
    'https://localhost/x',
    'not a url',
    '',
  ])('يرفض %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false)
  })
})
