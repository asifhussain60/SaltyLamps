import { onRequest as authenticateAdmin } from './api/admin/_middleware.js'
// Runs before every request to the site — storefront pages, static assets, API
// routes, all of it. Three jobs, and nothing else belongs here.
//
//   1. KEEP THE ADMIN OFF THE SHOP. When ADMIN_HOSTS names a hostname, /admin is
//      served there and refused everywhere else. Cloudflare Pages `_redirects`
//      cannot do this: its sources must be relative paths, so it never sees which
//      hostname the request arrived at. A Function is the only place that can.
//
//   2. KEEP SHOP ROUTES OFF THE ADMIN HOST. Both hostnames use the same code and
//      D1 binding, but / on the admin host opens /admin and shop pages move to
//      SITE_URL. Public APIs are unavailable there except image serving.
//
//   3. KEEP THE DUPLICATES OUT OF GOOGLE. One Pages project answers on several
//      hostnames — the real domain, the .pages.dev address, per-deployment preview
//      aliases, and now the admin subdomain. Every one of them serves the same
//      build carrying the same canonical tags pointing at the real domain, so all
//      but one are duplicates. Canonicals are a hint; a noindex header is not.
//
// WHY IT IS WRITTEN THE WAY IT IS. Root middleware is the most expensive place in
// this codebase to put anything, because it runs on requests that would otherwise
// never touch a Function at all. So the common path — a shopper loading a product
// photograph on the real domain — does two string comparisons and returns. Nothing
// is parsed, nothing is fetched, and the response is not even copied.
//
// Administrator pages reuse the API authentication gate after hostname checks.
// Public storefront and image requests never invoke token verification.

import {
  hostnameOf,
  isLocalHost,
  isAdminHost,
  primaryAdminHost,
  shouldDiscourageIndexing,
} from './lib/admin-hosts.mjs'

const ROBOTS_KEEP_OUT = 'User-agent: *\nDisallow: /\n'
const PUBLIC_PAGES = new Set([
  '/', '/shop', '/gallery', '/process', '/reviews', '/privacy-policy',
  '/terms-and-conditions', '/return-refund-policy', '/returns-exchanges',
  '/refund-request', '/checkout', '/checkout/address', '/checkout/payment',
  '/checkout/success', '/checkout/cancel', '/checkout/cancelled',
])
const PUBLIC_PAGE_PREFIXES = ['/product-page/', '/category/', '/collection/']

export async function onRequest(context) {
  const { request, env, next } = context
  const hostname = hostnameOf(request)
  const { pathname } = new URL(request.url)

  // The admin and shop share a Pages project and D1 binding, but not browser
  // destinations. Keep a bare admin bookmark on the dashboard and send customer
  // pages to this environment's shop URL instead of rendering a second shop on
  // the protected administrator hostname.
  if (!isLocalHost(hostname) && isAdminHost(hostname, env)) {
    if (pathname.startsWith('/api/') &&
        !pathname.startsWith('/api/admin/') &&
        !pathname.startsWith('/api/images/')) {
      return new Response('Not found', { status: 404 })
    }
    if ((request.method === 'GET' || request.method === 'HEAD') &&
        (PUBLIC_PAGES.has(pathname) || PUBLIC_PAGE_PREFIXES.some(prefix => pathname.startsWith(prefix)))) {
      if (pathname === '/') return Response.redirect(new URL('/admin', request.url), 302)
      let shop
      try { shop = new URL(env.SITE_URL) } catch { /* fail closed below */ }
      if (!shop || shop.protocol !== 'https:' || shop.hostname === hostname) {
        return new Response('Not found', { status: 404 })
      }
      const target = new URL(request.url)
      target.protocol = shop.protocol
      target.host = shop.host
      return Response.redirect(target, 302)
    }
  }

  // _redirects only accepts relative sources. Canonicalize actual shop page
  // requests here, preserving the full path/query and leaving API methods alone.
  // Static assets excluded by _routes.json still need launch-time zone rules.
  if ((request.method === 'GET' || request.method === 'HEAD') &&
      !pathname.startsWith('/api/') && !isAdminPath(pathname) &&
      (hostname === 'saltylamps.co.uk' ||
       (hostname === 'www.saltylamps.co.uk' && new URL(request.url).protocol === 'http:'))) {
    const canonical = new URL(request.url)
    canonical.protocol = 'https:'
    canonical.hostname = 'www.saltylamps.co.uk'
    canonical.port = ''
    return Response.redirect(canonical.toString(), 301)
  }

  // --- 1. the admin lives on its own hostname ------------------------------
  // Only /admin* is considered here. /api/admin/* is refused by its own
  // middleware, which returns a JSON error the admin UI can read rather than the
  // HTML redirect a browser wants — two different callers, two different answers.
  if (isAdminPath(pathname) && !isAdminHost(hostname, env)) {
    const target = primaryAdminHost(env)
    // A redirect rather than a 404 because the person hitting this is almost
    // always the owner following an old bookmark, and sending them to the right
    // place costs nothing: the admin behind it is still gated by Cloudflare
    // Access, so this discloses only that an admin exists somewhere — which the
    // hostname itself already does.
    if (target && target !== hostname) {
      const url = new URL(request.url)
      // Hostname only. The port is deliberately left alone: in production it is
      // already empty (443 is implied), so clearing it would be a no-op there —
      // and anywhere it is NOT empty, clearing it sends the browser to a port
      // nothing is listening on. It can only ever do harm.
      url.hostname = target
      return Response.redirect(url.toString(), 301)
    }
    // No safe destination is configured, so the public host does not disclose an
    // owner interface at all.
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
    })
  }

  // Access at the edge provides the sign-in screen. This origin check also
  // protects direct admin links when an Access application is missing/mis-scoped.
  if (isAdminPath(pathname) && !isLocalHost(hostname)) {
    return authenticateAdmin({ ...context, next: async () => {
      const response = await next()
      const protectedPage = new Response(response.body, response)
      protectedPage.headers.set('x-robots-tag', 'noindex, nofollow')
      return protectedPage
    } })
  }

  // The SPA fallback must carry a real 404 status for arbitrary addresses while
  // still returning the app shell, which provides the useful recovery screen.
  // Product, category and collection slugs are resolved client-side from live data;
  // their route families stay eligible here and unknown top-level pages do not.
  if (isUnknownBrowserPage(request, pathname)) {
    const response = await next()
    // Legacy Wix page redirects come from the delegated asset response. Keep
    // their status: replacing 301 with 404 strands real browser navigations.
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) return response
    const missing = new Response(response.body, { status: 404, headers: response.headers })
    missing.headers.set('x-robots-tag', 'noindex, nofollow')
    return missing
  }

  // --- 2. only one hostname is the real shop -------------------------------
  if (!shouldDiscourageIndexing(hostname, env)) return next()

  // robots.txt is answered here rather than deployed as a file, because one build
  // serves every hostname and therefore cannot ship two different robots files.
  if (pathname === '/robots.txt') {
    return new Response(ROBOTS_KEEP_OUT, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-robots-tag': 'noindex, nofollow',
      },
    })
  }

  // A crawler that ignores robots.txt still honours this, and unlike a <meta> tag
  // it also covers PDFs, images and anything else that is not HTML.
  const response = await next()
  const stamped = new Response(response.body, response)
  stamped.headers.set('x-robots-tag', 'noindex, nofollow')
  return stamped
}

function isAdminPath(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

function isUnknownBrowserPage(request, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  if (!String(request.headers.get('accept') || '').includes('text/html')) return false
  if (PUBLIC_PAGES.has(pathname) || isAdminPath(pathname)) return false
  return !PUBLIC_PAGE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}
