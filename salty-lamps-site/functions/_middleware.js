// Runs before every request to the site — storefront pages, static assets, API
// routes, all of it. Two jobs, and nothing else belongs here.
//
//   1. KEEP THE ADMIN OFF THE SHOP. When ADMIN_HOSTS names a hostname, /admin is
//      served there and refused everywhere else. Cloudflare Pages `_redirects`
//      cannot do this: its sources must be relative paths, so it never sees which
//      hostname the request arrived at. A Function is the only place that can.
//
//   2. KEEP THE DUPLICATES OUT OF GOOGLE. One Pages project answers on several
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
// Deliberately NOT here: authentication. The admin API gate lives in
// functions/api/admin/_middleware.js and stays there. This file decides WHERE the
// admin exists; that one decides WHO may use it. Collapsing the two would put
// token verification on the path of every image request on the site.

import {
  adminSplitConfigured,
  hostnameOf,
  isAdminHost,
  primaryAdminHost,
  shouldDiscourageIndexing,
} from './lib/admin-hosts.mjs'

const ROBOTS_KEEP_OUT = 'User-agent: *\nDisallow: /\n'

export async function onRequest(context) {
  const { request, env, next } = context
  const hostname = hostnameOf(request)
  const { pathname } = new URL(request.url)

  // --- 1. the admin lives on its own hostname ------------------------------
  // Only /admin* is considered here. /api/admin/* is refused by its own
  // middleware, which returns a JSON error the admin UI can read rather than the
  // HTML redirect a browser wants — two different callers, two different answers.
  if (isAdminPath(pathname) && adminSplitConfigured(env) && !isAdminHost(hostname, env)) {
    const target = primaryAdminHost(env)
    // A redirect rather than a 404 because the person hitting this is almost
    // always the owner following an old bookmark, and sending them to the right
    // place costs nothing: the admin behind it is still gated by Cloudflare
    // Access, so this discloses only that an admin exists somewhere — which the
    // hostname itself already does.
    if (target) {
      const url = new URL(request.url)
      // Hostname only. The port is deliberately left alone: in production it is
      // already empty (443 is implied), so clearing it would be a no-op there —
      // and anywhere it is NOT empty, clearing it sends the browser to a port
      // nothing is listening on. It can only ever do harm.
      url.hostname = target
      return Response.redirect(url.toString(), 301)
    }
    // ADMIN_HOSTS holds only wildcard patterns, so there is nowhere to send them.
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
    })
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
