import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/_middleware.js'

test('shop canonical redirects preserve path and query without redirecting APIs, admin or previews', async () => {
  const next = async () => new Response('next')
  for (const origin of ['http://saltylamps.co.uk', 'https://saltylamps.co.uk', 'http://www.saltylamps.co.uk']) {
    const result = await onRequest({ request: new Request(origin + '/shop?category=salt'), env: {}, next })
    assert.equal(result.status, 301)
    assert.equal(result.headers.get('location'), 'https://www.saltylamps.co.uk/shop?category=salt')
  }
  for (const url of ['https://www.saltylamps.co.uk/shop', 'http://localhost/shop', 'https://preview.pages.dev/shop', 'https://saltylamps.co.uk/api/products']) {
    const result = await onRequest({ request: new Request(url), env: {}, next })
    assert.equal(result.status, 200)
  }
  const post = await onRequest({ request: new Request('http://saltylamps.co.uk/api/checkout', { method: 'POST' }), env: {}, next })
  assert.equal(post.status, 200)
  const admin = await onRequest({ request: new Request('https://saltylamps.co.uk/admin'), env: {}, next })
  assert.equal(admin.status, 404)
})

test('unknown browser pages retain legacy redirects but genuine missing pages remain 404', async () => {
  const request = new Request('http://localhost/blog', { headers: { accept: 'text/html' } })
  const redirected = await onRequest({ request, env: {}, next: async () => new Response(null, { status: 301, headers: { location: '/shop' } }) })
  assert.equal(redirected.status, 301)
  assert.equal(redirected.headers.get('location'), '/shop')
  const missing = await onRequest({ request, env: {}, next: async () => new Response('shell') })
  assert.equal(missing.status, 404)
  assert.equal(missing.headers.get('x-robots-tag'), 'noindex, nofollow')
})
