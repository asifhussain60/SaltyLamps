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

// The launch flip removes STRIPE_TEST_ONLY, MAIL_DRY_RUN and STAGING_IMAGE_STORAGE. These two
// pin down what that does to photos, so the runbook's R2 blocker is a tested fact, not a worry.
test('live mode with R2 bound stores and serves photos from R2 alone', async () => {
  const objects = new Map()
  const bytes = new Uint8Array([255, 216, 255, 224])
  const env = { // wrangler.live.toml: no sandbox switches, IMAGES bound, and no database access for photos
    DB: { prepare() { throw new Error('Photos must not touch the database in live mode') } },
    IMAGES: {
      async put(key, body, options) { objects.set(key, { body, options }) },
      async get(key) { return objects.has(key) ? { body: objects.get(key).body, httpEtag: '"x"', size: bytes.length, httpMetadata: { contentType: 'image/jpeg' } } : null },
      async head(key) { return objects.has(key) ? { size: bytes.length } : null },
    },
  }
  const uploaded = await putImageObject(env, 'product-1', { buffer: bytes.buffer, type: 'image/jpeg', ext: 'jpg' })
  const served = await onRequestGet({ env, params: { path: [uploaded.key.replace('/api/images/', '')] }, request: new Request('https://www.saltylamps.co.uk' + uploaded.url) })
  assert.equal(served.status, 200)
})

test('live mode WITHOUT R2 serves no photos, so a test-database photo disappears at launch', async () => {
  const env = { DB: { prepare() { throw new Error('must not read the test photo tables') } } }
  const response = await onRequestGet({ env, params: { path: ['any-uploaded-photo.jpg'] }, request: new Request('https://www.saltylamps.co.uk/api/images/any-uploaded-photo.jpg') })
  assert.equal(response.status, 503)
  // Sandbox photo storage needs all three test switches; removing any one of them disables it.
  for (const partial of [{ STAGING_IMAGE_STORAGE: 'd1', STRIPE_TEST_ONLY: '1' }, { STAGING_IMAGE_STORAGE: 'd1', MAIL_DRY_RUN: 'true' }]) {
    const res = await onRequestGet({ env: { ...env, ...partial }, params: { path: ['x.jpg'] }, request: new Request('https://www.saltylamps.co.uk/api/images/x.jpg') })
    assert.equal(res.status, 503)
  }
})
