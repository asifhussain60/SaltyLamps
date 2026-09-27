import test from 'node:test'
import assert from 'node:assert/strict'
import { storeHref } from '../src/admin/store-url.mjs'

test('admin shop shortcuts use the protected test shop during staging', () => {
  assert.equal(storeHref('/shop', 'admin.saltylamps.co.uk', true), 'https://test.saltylamps.co.uk/shop')
  assert.equal(storeHref('/#trade', 'admin.saltylamps.co.uk', true), 'https://test.saltylamps.co.uk/#trade')
})

test('production admin shortcuts use the public shop while local development stays local', () => {
  assert.equal(storeHref('/', 'admin.saltylamps.co.uk', false), 'https://www.saltylamps.co.uk/')
  assert.equal(storeHref('/shop', 'localhost', true), '/shop')
  assert.equal(storeHref('/admin/orders', 'admin.saltylamps.co.uk', true), '/admin/orders')
})
