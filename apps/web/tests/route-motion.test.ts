import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolvePageTransition, routeDepth } from '../app/utils/route-motion.ts'

describe('routeDepth', () => {
  it('الوجهات الرئيسية بعمق 0', () => {
    for (const p of [
      '/',
      '/bookings',
      '/stats',
      '/customers',
      '/services',
      '/users',
      '/settings',
      '/more',
    ])
      assert.equal(routeDepth(p), 0, p)
  })

  it('الصفحات الفرعية أعمق', () => {
    assert.equal(routeDepth('/bookings/new'), 1)
    assert.equal(routeDepth('/customers/abc'), 1)
    assert.equal(routeDepth('/bookings/abc/edit'), 2)
    assert.equal(routeDepth('/account'), 1)
  })

  it('يتجاهل الاستعلام والوسم', () => {
    assert.equal(routeDepth('/?date=2026-11-08'), 0)
    assert.equal(routeDepth('/bookings/new?start=x#y'), 1)
  })
})

describe('resolvePageTransition', () => {
  it('الأعمق يتقدّم والأقل يرجع', () => {
    assert.equal(resolvePageTransition('/', '/bookings/new'), 'page-forward')
    assert.equal(resolvePageTransition('/more', '/account'), 'page-forward')
    assert.equal(resolvePageTransition('/bookings/new', '/'), 'page-back')
    assert.equal(resolvePageTransition('/bookings/a/edit', '/bookings/new'), 'page-back')
  })

  it('نفس المستوى تلاشٍ', () => {
    assert.equal(resolvePageTransition('/', '/stats'), 'page-fade')
    assert.equal(resolvePageTransition('/customers/a', '/bookings/new'), 'page-fade')
  })
})
