import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet, onRequestHead } from '../functions/api/images/[[path]].js'
import { putImageObject, getImageObject, deleteImageObject } from '../functions/lib/image-upload.mjs'

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

test('configured production image storage keeps precedence over test database storage', async () => {
  const objects = new Map()
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const env = {
    STAGING_IMAGE_STORAGE: 'd1', STRIPE_TEST_ONLY: '1', MAIL_DRY_RUN: 'true',
    DB: { prepare() { throw new Error('Test database must not be used') } },
    IMAGES: {
      async put(key, body, options) { objects.set(key, { body, options }) },
      async get(key) { return objects.get(key) || null },
      async head(key) { return objects.has(key) ? { size: bytes.length } : null },
      async delete(key) { objects.delete(key) },
    },
  }
  const uploaded = await putImageObject(env, 'product-1', { buffer: bytes.buffer, type: 'image/png', ext: 'png' })
  assert.equal(objects.get(uploaded.key).options.httpMetadata.contentType, 'image/png')
  assert.deepEqual(new Uint8Array((await getImageObject(env, uploaded.key)).body), bytes)
  assert.equal((await getImageObject(env, uploaded.key, true)).size, bytes.length)
  await deleteImageObject(env, uploaded.key)
  assert.equal(objects.size, 0)
})
