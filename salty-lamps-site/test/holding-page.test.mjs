import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../holding-site/_worker.js'

test('holding deployment covers deep links and rejects commerce writes without forwarding them', async () => {
  const requests = []
  const env = { ASSETS: { fetch: async request => {
    requests.push({ method: request.method, path: new URL(request.url).pathname })
    return new Response('<h1>Under construction</h1>')
  } } }
  for (const path of ['/', '/shop', '/product-page/example', '/admin', '/api/admin/products', '/api/checkout']) {
    for (const method of ['GET', 'POST']) {
      const response = await worker.fetch(new Request('https://www.saltylamps.co.uk' + path, { method }), env)
      assert.equal(response.status, 503)
      assert.equal(response.headers.get('retry-after'), '3600')
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.match(await response.text(), /Under construction/)
    }
  }
  assert.ok(requests.every(r => r.method === 'GET' && r.path === '/index.html'))
})

test('holding assets load normally and HEAD maintenance responses have no body', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') } }
  const asset = await worker.fetch(new Request('https://www.saltylamps.co.uk/holding-assets/style.css'), env)
  assert.equal(asset.status, 200)
  const head = await worker.fetch(new Request('https://www.saltylamps.co.uk/', { method: 'HEAD' }), env)
  assert.equal(head.status, 503)
  assert.equal(await head.text(), '')
})

test('public crawlers can observe temporary unavailability while preview indexing stays disabled', async () => {
  const env = { ASSETS: { fetch: async () => new Response('holding') } }
  const publicPage = await worker.fetch(new Request('https://www.saltylamps.co.uk/'), env)
  assert.equal(publicPage.headers.get('x-robots-tag'), null)
  const preview = await worker.fetch(new Request('https://salty-lamps.pages.dev/'), env)
  assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow')
  const robots = await worker.fetch(new Request('https://www.saltylamps.co.uk/robots.txt'), env)
  assert.equal(robots.status, 200)
  assert.equal(await robots.text(), 'User-agent: *\nDisallow:\n')
})
