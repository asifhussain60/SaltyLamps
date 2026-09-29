// GET /api/images/* — serve uploaded product images from the configured store.
//
// Public on purpose (shoppers load these), so it sits outside /api/admin and its
// auth middleware. A long immutable cache means Cloudflare's edge serves repeat
// loads without re-invoking this Worker; keys are random so they never collide.
import { getImageObject, hasImageStorage } from '../../lib/image-upload.mjs'
async function serveImage({ params, env, request }) {
  if (!hasImageStorage(env)) return new Response('Image storage not configured', { status: 503 })

  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '')
  if (!key) return new Response('Not found', { status: 404 })

  const headOnly = request.method === 'HEAD'
  const object = await getImageObject(env, key, headOnly)
  if (!object || (!headOnly && !object.body)) return new Response('Not found', { status: 404 })

  // Honour conditional requests so the edge/browser can revalidate cheaply.
  const ifNoneMatch = request.headers.get('If-None-Match')
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers: { etag: object.httpEtag } })
  }

  const headers = new Headers()
  headers.set('content-type', object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('etag', object.httpEtag)
  headers.set('x-content-type-options', 'nosniff')
  if (Number.isFinite(object.size)) headers.set('content-length', String(object.size))
  return new Response(headOnly ? null : object.body, { headers })
}

export const onRequestGet = serveImage
export const onRequestHead = serveImage
