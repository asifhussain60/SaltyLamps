// Shared multipart-image-upload helpers for the admin gallery endpoints
// (functions/api/admin/products/[id]/images.js and .../images/[imageId]/replace.js).
//
// Security is entirely server-side (the browser can be bypassed):
//   - reject before buffering if Content-Length exceeds the cap
//   - sniff magic bytes; only real JPEG/PNG/WebP pass (SVG and everything else rejected)
//   - store under a generated key, never the client's filename
import { apiError } from './admin-helpers.mjs'
import { MAX_IMAGE_BYTES } from './validation.mjs'

const SERVE_PREFIX = '/api/images/'
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

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

// Writes an uploaded image to R2 under a random per-product key. Returns { key, path }.
export async function putImageObject(env, productId, upload) {
  const key = `products/${productId}/${crypto.randomUUID()}.${upload.ext}`
  await env.IMAGES.put(key, upload.buffer, { httpMetadata: { contentType: upload.type } })
  return { key, path: `${SERVE_PREFIX}${key}` }
}

// Deletes an R2 object, ignoring keys that aren't ours to manage (legacy static
// /media/... images have no key) and tolerating a stray object that's already gone.
export async function deleteImageObject(env, key) {
  if (!key) return
  try {
    await env.IMAGES.delete(key)
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
