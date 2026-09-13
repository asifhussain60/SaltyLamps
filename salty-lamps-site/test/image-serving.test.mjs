import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet, onRequestHead } from '../functions/api/images/[[path]].js'

test('uploaded images return matching GET/HEAD metadata and real missing status', async () => {
  let reads = 0
  const metadata = { httpEtag: '"abc"', size: 3, httpMetadata: { contentType: 'image/png' } }
  const env = { IMAGES: {
    get: async key => { reads++; return key === 'a.png' ? { ...metadata, body: new Uint8Array([1,2,3]) } : null },
    head: async key => key === 'a.png' ? metadata : null,
  } }
  const context = (method, name = 'a.png', headers = {}) => ({ env, params: { path: [name] }, request: new Request('https://example.test/api/images/' + name, { method, headers }) })
  const get = await onRequestGet(context('GET'))
  const head = await onRequestHead(context('HEAD'))
  assert.equal(get.status, 200)
  assert.equal(head.status, 200)
  for (const field of ['content-type','content-length','etag','cache-control']) assert.equal(head.headers.get(field), get.headers.get(field))
  assert.equal(await head.text(), '')
  assert.equal(reads, 1)
  assert.equal((await onRequestHead(context('HEAD', 'missing.png'))).status, 404)
  assert.equal((await onRequestGet(context('GET', 'a.png', { 'If-None-Match': '"abc"' }))).status, 304)
})
