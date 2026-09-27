import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onRequest } from '../functions/_middleware.js'

const env = {
  ADMIN_HOSTS: 'admin.saltylamps.co.uk',
  SITE_URL: 'https://test.saltylamps.co.uk',
  PUBLIC_HOST: 'www.saltylamps.co.uk',
}

async function visit(url, options = {}) {
  return onRequest({
    request: new Request(url, options),
    env,
    next: async () => new Response('served'),
  })
}

test('bare admin address opens the dashboard while shop pages keep their path and query on the test host', async () => {
  const root = await visit('https://admin.saltylamps.co.uk/')
  assert.equal(root.status, 302)
  assert.equal(root.headers.get('location'), 'https://admin.saltylamps.co.uk/admin')

  for (const path of ['/shop?sort=price', '/product-page/angel-shape-himalayan-rock-salt-lamp', '/checkout/address']) {
    const response = await visit(`https://admin.saltylamps.co.uk${path}`)
    assert.equal(response.status, 302, path)
    assert.equal(response.headers.get('location'), `https://test.saltylamps.co.uk${path}`, path)
  }
})

test('non-admin API paths are absent on the administrator host', async () => {
  for (const path of ['/api/products', '/api/checkout', '/api/webhook']) {
    assert.equal((await visit(`https://admin.saltylamps.co.uk${path}`)).status, 404, path)
  }
  assert.equal((await visit('https://admin.saltylamps.co.uk/api/images/example')).status, 200)
})

test('the shop host still serves shop paths and sends old admin bookmarks to the dedicated host', async () => {
  assert.equal((await visit('https://test.saltylamps.co.uk/shop')).status, 200)
  const oldBookmark = await visit('https://test.saltylamps.co.uk/admin/orders')
  assert.equal(oldBookmark.status, 301)
  assert.equal(oldBookmark.headers.get('location'), 'https://admin.saltylamps.co.uk/admin/orders')
})
