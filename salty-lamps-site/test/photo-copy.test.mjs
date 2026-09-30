import assert from 'node:assert/strict'
import test from 'node:test'
import { SQL_CHUNKS, SQL_OBJECTS, assertSafeKey, reassemble, sha256 } from '../scripts/photo-copy-lib.mjs'
import { assertReadOnlySql } from '../scripts/read-only-sql.mjs'

const photo = Buffer.from(Array.from({ length: 1500 }, (_, i) => (i * 7) % 256))
const object = { key: 'products/p1/a.png', content_type: 'image/png', size: photo.length, etag: `"${sha256(photo)}"` }
const split = (key, bytes, size) => Array.from({ length: Math.ceil(bytes.length / size) }, (_, part) => ({
  key, part, bytes: bytes.subarray(part * size, (part + 1) * size).toString('base64'),
}))

test('a photo stored in several chunks is rebuilt byte for byte and verified against its stored checksum', () => {
  const rebuilt = reassemble(object, [...split(object.key, photo, 512), ...split('products/p1/other.png', Buffer.from('zzz'), 512)])
  assert.ok(rebuilt.bytes.equals(photo))
  assert.equal(rebuilt.contentType, 'image/png')
})

test('chunks arriving out of order are still put back in order', () => {
  const chunks = split(object.key, photo, 400).reverse()
  assert.ok(reassemble(object, chunks).bytes.equals(photo))
})

test('a missing chunk, wrong size or altered byte is refused instead of copied', () => {
  const chunks = split(object.key, photo, 512)
  assert.throws(() => reassemble(object, [chunks[0], chunks[2]]), /chunk 1 is missing/)
  assert.throws(() => reassemble({ ...object, size: photo.length + 1 }, chunks), /expected/)
  const altered = split(object.key, Buffer.concat([photo.subarray(0, 10), Buffer.from([0]), photo.subarray(11)]), 512)
  assert.throws(() => reassemble(object, altered), /checksum/)
  assert.throws(() => reassemble(object, []), /no data chunks/)
})

test('only generated product photo keys are copied and path tricks are refused', () => {
  assert.equal(assertSafeKey('products/product_1b92dfb0-dae3/req-1-abc.png'), 'products/product_1b92dfb0-dae3/req-1-abc.png')
  for (const bad of ['../secrets.png', 'products/../x.png', 'other/p/a.png', 'products/p/a.svg', 'products/p/a/b.png', '/products/p/a.png']) {
    assert.throws(() => assertSafeKey(bad), /Refusing/, bad)
  }
})

test('the two queries the copy runs against the shop database are plain reads', () => {
  assert.doesNotThrow(() => assertReadOnlySql([SQL_OBJECTS, SQL_CHUNKS]))
})
