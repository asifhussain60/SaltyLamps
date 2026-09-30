// Pure helpers for copying the test shop's database-stored photos into R2.
//
// The test shop keeps uploaded photos in two tables (functions/lib/image-upload.mjs):
// an object row (key, content type, size, etag = quoted SHA-256 of the bytes) and one or
// more base64 chunk rows. Nothing here touches the network; the script that calls it does.
import { createHash } from 'node:crypto'

export const SQL_OBJECTS = 'SELECT key, content_type, size, etag FROM staging_image_objects ORDER BY key'
export const SQL_CHUNKS = 'SELECT key, part, bytes FROM staging_image_chunks ORDER BY key, part'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

// Rebuilds one photo from its chunks and proves it is whole: every part present, the size
// matches the object row, and the SHA-256 matches the etag the shop stored at upload time.
// Anything else throws, because a corrupt photo copied into R2 would look fine until a
// shopper loads it.
export function reassemble(object, chunks) {
  const parts = chunks.filter(chunk => chunk.key === object.key).sort((a, b) => a.part - b.part)
  if (parts.length === 0) throw new Error(`${object.key}: no data chunks`)
  parts.forEach((chunk, index) => {
    if (chunk.part !== index) throw new Error(`${object.key}: chunk ${index} is missing`)
  })
  const bytes = Buffer.concat(parts.map(chunk => (
    typeof chunk.bytes === 'string' ? Buffer.from(chunk.bytes, 'base64') : Buffer.from(chunk.bytes)
  )))
  if (bytes.length !== object.size) throw new Error(`${object.key}: expected ${object.size} bytes, rebuilt ${bytes.length}`)
  const digest = sha256(bytes)
  const expected = String(object.etag || '').replaceAll('"', '')
  if (digest !== expected) throw new Error(`${object.key}: checksum differs from the stored etag`)
  return { key: object.key, contentType: object.content_type, bytes, digest }
}

// Only keys the shop itself generates for product photos are copied, and never one that
// could escape the products/ folder.
export function assertSafeKey(key) {
  if (!/^products\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(key)) {
    throw new Error(`Refusing to copy an unexpected object key: ${key}`)
  }
  return key
}
