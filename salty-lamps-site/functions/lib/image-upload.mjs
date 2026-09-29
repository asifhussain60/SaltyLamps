// Shared multipart-image-upload helpers for the admin gallery endpoints
// (functions/api/admin/products/[id]/images.js and .../images/[imageId]/replace.js).
//
// Security is entirely server-side (the browser can be bypassed):
//   - reject before buffering if Content-Length exceeds the cap
//   - sniff magic bytes; only real JPEG/PNG/WebP pass (SVG and everything else rejected)
//   - store under a generated key, never the client's filename
import { Buffer } from 'node:buffer'
import { apiError } from './admin-helpers.mjs'
import { MAX_IMAGE_BYTES } from './validation.mjs'

const SERVE_PREFIX = '/api/images/'
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const STAGING_CHUNK_BYTES = 512 * 1024

export function hasImageStorage(env) {
  return !!env.IMAGES || (
    env.STAGING_IMAGE_STORAGE === 'd1' && env.STRIPE_TEST_ONLY === '1' &&
    env.MAIL_DRY_RUN === 'true' && !!env.DB
  )
}

function usesStagingDatabase(env) {
  return !env.IMAGES && hasImageStorage(env)
}

// Returns 'image/jpeg' | 'image/png' | 'image/webp' | null by inspecting bytes.
function sniffImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) return 'image/webp'
  return null
}

// Reads and validates a multipart image upload from a request.
// Returns [{ buffer, type, ext }, null] or [null, Response].
export async function readUploadedImage(request) {
  const declaredLen = Number(request.headers.get('Content-Length') || 0)
  if (declaredLen && declaredLen > MAX_IMAGE_BYTES + 4096) {
    return [null, apiError('Image must be 2 MB or smaller.', 413, { code: 'too_large' })]
  }

  let file
  try {
    const form = await request.formData()
    file = form.get('image') || form.get('file')
  } catch {
    return [null, apiError('Expected a multipart form upload.', 400)]
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return [null, apiError('No image file provided.', 400)]
  }

  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return [null, apiError('Image must be 2 MB or smaller.', 413, { code: 'too_large' })]
  }

  const bytes = new Uint8Array(buffer)
  const type = sniffImageType(bytes)
  if (!type) {
    return [null, apiError('Only JPEG, PNG or WebP images are allowed.', 400, { code: 'bad_image' })]
  }

  return [{ buffer, type, ext: EXT[type] }, null]
}

// The protected sandbox stores small uploads in its existing D1 database until
// the owner activates R2 for production. Chunks are base64 text, not BLOBs: the
// D1 binding marshals a BLOB as one JS number per byte, which costs tens of
// milliseconds of Worker CPU per photo against the Free plan's 10 ms. A 512 KiB
// chunk becomes ~683 KiB of text, still below D1's 2 MB row limit.
export async function putImageObject(env, productId, upload, objectId = crypto.randomUUID()) {
  const key = `products/${productId}/${objectId}.${upload.ext}`
  if (usesStagingDatabase(env)) {
    const bytes = new Uint8Array(upload.buffer)
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    const statements = [env.DB.prepare(
      'INSERT OR REPLACE INTO staging_image_objects(key,content_type,size,etag) VALUES(?,?,?,?)',
    ).bind(key, upload.type, bytes.length, `"${digest}"`)]
    for (let offset = 0, part = 0; offset < bytes.length; offset += STAGING_CHUNK_BYTES, part++) {
      const chunk = Buffer.from(bytes.buffer, bytes.byteOffset + offset, Math.min(STAGING_CHUNK_BYTES, bytes.length - offset))
      statements.push(env.DB.prepare(
        'INSERT OR REPLACE INTO staging_image_chunks(key,part,bytes) VALUES(?,?,?)',
      ).bind(key, part, chunk.toString('base64')))
    }
    await env.DB.batch(statements)
  } else {
    await env.IMAGES.put(key, upload.buffer, { httpMetadata: { contentType: upload.type } })
  }
  return { key, path: `${SERVE_PREFIX}${key}` }
}

export async function getImageObject(env, key, headOnly = false) {
  if (!usesStagingDatabase(env)) return headOnly ? env.IMAGES.head(key) : env.IMAGES.get(key)
  const row = await env.DB.prepare(
    'SELECT content_type,size,etag FROM staging_image_objects WHERE key=?',
  ).bind(key).first()
  if (!row) return null
  const metadata = { size: row.size, httpEtag: row.etag, httpMetadata: { contentType: row.content_type } }
  if (headOnly) return metadata
  const parts = await env.DB.prepare(
    'SELECT bytes FROM staging_image_chunks WHERE key=? ORDER BY part',
  ).bind(key).all()
  const bytes = new Uint8Array(row.size)
  let offset = 0
  for (const part of parts.results || []) {
    // Base64 text; a BLOB byte array is still read in case one was stored earlier.
    const chunk = typeof part.bytes === 'string' ? Buffer.from(part.bytes, 'base64') : new Uint8Array(part.bytes)
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  if (offset !== row.size) throw new Error('Stored image is incomplete')
  return { ...metadata, body: bytes }
}

// Deletes an uploaded object, ignoring static /media/... images without a key
// and tolerating a stray object that's already gone.
export async function deleteImageObject(env, key) {
  if (!key) return
  try {
    if (usesStagingDatabase(env)) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM staging_image_chunks WHERE key=?').bind(key),
        env.DB.prepare('DELETE FROM staging_image_objects WHERE key=?').bind(key),
      ])
    } else if (env.IMAGES) await env.IMAGES.delete(key)
  } catch {
    // Non-fatal: a stray old object is harmless.
  }
}

// Keeps products.image in sync with the gallery's primary (lowest sort_order) image.
// Call after every gallery mutation (add/delete/replace) — cheap and always correct,
// regardless of which row happened to change. Returns a prepared statement to include
// in the caller's db.batch([...]).
export function syncPrimaryImageStmt(db, productId, primaryPath) {
  return db.prepare(`UPDATE products SET image = ? WHERE id = ?`).bind(primaryPath || '', productId)
}

export async function currentPrimaryPath(db, productId) {
  const row = await db.prepare(
    `SELECT path FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1`,
  ).bind(productId).first()
  return row?.path || ''
}

// Evaluate the cover inside the caller's mutation batch, after its gallery edit.
export function syncCurrentPrimaryImageStmt(db, productId) {
  return db.prepare("UPDATE products SET image=COALESCE((SELECT path FROM product_images WHERE product_id=? ORDER BY sort_order,id LIMIT 1),'') WHERE id=?").bind(productId,productId)
}
