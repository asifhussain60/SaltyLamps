// Holding-only deployment. No database, commerce application or customer data.
const assets = new Set([
  '/holding-assets/logo.jpeg',
  '/holding-assets/wooden-salt-frame.jpg',
  '/holding-assets/style.css',
])
const headers = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const read = request.method === 'GET' || request.method === 'HEAD'
    if (read && assets.has(url.pathname)) return env.ASSETS.fetch(request)
    if (read && url.pathname === '/robots.txt') {
      const robots = url.hostname.endsWith('.pages.dev') ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nDisallow:\n'
      return new Response(request.method === 'HEAD' ? null : robots, { headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } })
    }
    // All page, admin and API addresses remain unavailable during construction.
    // Fetch only the static HTML; never forward requests to the shop or Wix.
    const index = await env.ASSETS.fetch(new Request(new URL('/index.html', url), { method: 'GET' }))
    return new Response(request.method === 'HEAD' ? null : index.body, {
      status: 503,
      headers: {
        ...headers,
        'content-type': 'text/html; charset=utf-8',
        'retry-after': '3600',
        ...(url.hostname.endsWith('.pages.dev') ? { 'x-robots-tag': 'noindex, nofollow' } : {}),
      },
    })
  },
}
