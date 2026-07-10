// POST /api/admin/products/:id/image — upload/replace a product image (multipart).
//
// Security is entirely server-side (the browser can be bypassed):
//   - reject before buffering if Content-Length exceeds the cap
//   - sniff magic bytes; only real JPEG/PNG/WebP pass (SVG and everything else rejected)
//   - store under a generated key, never the client's filename
//   - on replace, delete the previous uploaded object
import { json, apiError, auditStmt } from '../../../../lib/admin-helpers.mjs'
import { MAX_IMAGE_BYTES } from '../../../../lib/validation.mjs'

const SERVE_PREFIX = '/api/images/'

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

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function onRequestPost({ params, request, env, data }) {
  if (!env.IMAGES) return apiError('Image storage is not configured.', 503, { code: 'no_storage' })

  // Cheap early rejection before reading the whole body.
  const declaredLen = Number(request.headers.get('Content-Length') || 0)
  if (declaredLen && declaredLen > MAX_IMAGE_BYTES + 4096) {
    return apiError('Image must be 2 MB or smaller.', 413, { code: 'too_large' })
  }

  let file
  try {
    const form = await request.formData()
    file = form.get('image') || form.get('file')
  } catch {
    return apiError('Expected a multipart form upload.', 400)
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return apiError('No image file provided.', 400)
  }

  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return apiError('Image must be 2 MB or smaller.', 413, { code: 'too_large' })
  }

  const bytes = new Uint8Array(buffer)
  const type = sniffImageType(bytes)
  if (!type) {
    return apiError('Only JPEG, PNG or WebP images are allowed.', 400, { code: 'bad_image' })
  }

  try {
    const product = await env.DB.prepare(`SELECT id, image FROM products WHERE id = ?`).bind(params.id).first()
    if (!product) return apiError('Product not found.', 404, { code: 'not_found' })

    const key = `products/${params.id}/${crypto.randomUUID()}.${EXT[type]}`
    await env.IMAGES.put(key, buffer, { httpMetadata: { contentType: type } })
    const servedPath = `${SERVE_PREFIX}${key}`

    await env.DB.batch([
      env.DB.prepare(`UPDATE products SET image = ? WHERE id = ?`).bind(servedPath, params.id),
      auditStmt(env.DB, data.actorEmail, 'image.upload', 'product', params.id, { key }),
    ])

    // Clean up the previous object, but only if it was a prior upload (leave the
    // legacy static /media/... paths — those live in the repo, not in R2).
    const prev = product.image || ''
    if (prev.startsWith(SERVE_PREFIX) && prev !== servedPath) {
      try {
        await env.IMAGES.delete(prev.slice(SERVE_PREFIX.length))
      } catch {
        // Non-fatal: a stray old object is harmless.
      }
    }

    return json({ image: servedPath })
  } catch (err) {
    return apiError(`Could not upload image: ${err.message}`, 500, { code: 'server_error' })
  }
}
