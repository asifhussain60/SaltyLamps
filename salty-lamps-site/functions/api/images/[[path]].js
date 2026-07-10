// GET /api/images/* — public serve of uploaded product images from R2.
//
// Public on purpose (shoppers load these), so it sits outside /api/admin and its
// auth middleware. A long immutable cache means Cloudflare's edge serves repeat
// loads without re-invoking this Worker; keys are random so they never collide.
export async function onRequestGet({ params, env, request }) {
  if (!env.IMAGES) return new Response('Image storage not configured', { status: 503 })

  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '')
  if (!key) return new Response('Not found', { status: 404 })

  const object = await env.IMAGES.get(key)
  if (!object || !object.body) return new Response('Not found', { status: 404 })

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
  return new Response(object.body, { headers })
}
