// Which hostnames the admin is served from, and which ones may skip the sign-in.
//
// WHY THIS IS A MODULE. Two middlewares need the same answer about the same
// request: the root one (functions/_middleware.js), which decides whether the
// /admin HTML is served at all, and the admin API one
// (functions/api/admin/_middleware.js), which decides whether /api/admin/* is
// answered. Two copies of a hostname comparison is exactly the kind of drift
// that opens a door on one path and not the other, so there is one copy here.
//
// THE RULE THE WHOLE FILE EXISTS TO ENFORCE: a hostname does not travel with the
// code. A boolean flag does. DEV_ADMIN_BYPASS was once set as a production secret
// and honoured everywhere it was found, which served the whole catalogue, the
// whole order list and the delete and refund routes to anyone who asked (see
// infra/admin-access.md). Every decision below is therefore tied to WHERE the
// request arrived, never to whether someone remembered to unset something.
//
// THE THREE VARIABLES, and the difference between them:
//
//   ADMIN_HOSTS       Where the admin LIVES. When set, /admin and /api/admin/*
//                     exist on these hostnames and nowhere else. When UNSET the
//                     admin is served everywhere, which is the behaviour this
//                     project had before the subdomain split — so an existing
//                     deployment that never sets it is completely unaffected.
//
//   ADMIN_OPEN_HOSTS  Where the admin needs NO SIGN-IN. Strictly narrower than
//                     the above and never the same list in production: it exists
//                     so the test site is clickable before Cloudflare Access is
//                     configured. Naming the production admin host here would
//                     publish the order book.
//
//   PUBLIC_HOST       The one hostname that is the real shop, for search engines.
//                     Anything else serving the same build — the .pages.dev
//                     address, a preview alias, the admin subdomain — is a
//                     duplicate of it and must not be indexed. Falls back to the
//                     host in SITE_URL, which production already sets.
//
// Each is a comma-separated list; an entry beginning with a dot matches any
// subdomain of it, which is what covers Cloudflare's per-deployment preview
// aliases (<hash>.<project>.pages.dev) without listing each one.

// `wrangler pages dev` serves on localhost; a deployed Function is reached through
// the project's own hostnames and can never see one of these. `.localhost` suffixes
// are included because they are a standard local-dev convention and resolve to the
// loopback address by specification.
export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

export function isTruthy(v) {
  return v === true || v === 1 || v === '1' || v === 'true'
}

export function isLocalHost(hostname) {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost')
}

// Comma-separated hostnames. An entry starting with a dot matches any subdomain
// of it. Comparison is case-insensitive because a Host header need not be lower.
export function hostMatches(hostname, list) {
  const host = String(hostname || '').toLowerCase()
  for (const raw of String(list || '').split(',')) {
    const entry = raw.trim().toLowerCase()
    if (!entry) continue
    if (entry.startsWith('.') ? host.endsWith(entry) : host === entry) return true
  }
  return false
}

export function hostnameOf(request) {
  try {
    return new URL(request.url).hostname.toLowerCase()
  } catch {
    return null
  }
}

// Is the admin served at this hostname?
//
// UNSET MEANS EVERYWHERE, and that is deliberate rather than an oversight. This
// module landed on a running site; defaulting to "nowhere" would have taken the
// admin off the test site the moment it deployed, and defaulting to a guessed
// hostname would be worse. Setting ADMIN_HOSTS is the single, visible action that
// turns the split on — and the migration runbook has the owner prove both hosts
// behave correctly before trusting it.
//
// Localhost always counts, so `wrangler pages dev` keeps working whatever the
// variable says.
export function isAdminHost(hostname, env) {
  if (!hostname) return false
  if (isLocalHost(hostname)) return true
  const list = env?.ADMIN_HOSTS
  if (!String(list || '').trim()) return true
  return hostMatches(hostname, list)
}

// Has an admin host actually been configured? Distinct from isAdminHost() because
// "no split configured" and "this host is not the admin" need different handling:
// the first is the old world, the second is a request to refuse.
export function adminSplitConfigured(env) {
  return Boolean(String(env?.ADMIN_HOSTS || '').trim())
}

// The first ADMIN_HOSTS entry that is a usable redirect target — a bare hostname,
// not a `.suffix` wildcard, which is a matching pattern and not somewhere a browser
// can be sent. Returns null when there is nothing sensible to redirect to, and the
// caller answers 404 instead.
export function primaryAdminHost(env) {
  for (const raw of String(env?.ADMIN_HOSTS || '').split(',')) {
    const entry = raw.trim().toLowerCase()
    if (entry && !entry.startsWith('.')) return entry
  }
  return null
}

// The hostname search engines should treat as the real shop. PUBLIC_HOST wins;
// otherwise the host out of SITE_URL, which production sets anyway for Stripe
// redirects and email links. Null when neither is set, in which case the caller
// must not make any indexing decision at all.
export function publicHost(env) {
  const explicit = String(env?.PUBLIC_HOST || '').trim().toLowerCase()
  if (explicit) return explicit
  try {
    return new URL(env.SITE_URL).hostname.toLowerCase()
  } catch {
    return null
  }
}

// Should a crawler be told to stay away from this hostname entirely?
//
// True for every host that is not the canonical shop: the .pages.dev address, the
// admin subdomain, preview aliases. All of them serve the same build with the same
// canonical tags pointing at the real domain, so leaving them crawlable invites
// Google to pick a winner between duplicates. Localhost is excluded because
// nothing crawls it and a noindex header there is just noise in dev.
//
// When neither PUBLIC_HOST nor SITE_URL is set we cannot know which host is real,
// and guessing could noindex the actual shop — so the answer is false. Being
// indexed by mistake is recoverable; de-indexing the shop is not.
export function shouldDiscourageIndexing(hostname, env) {
  if (!hostname || isLocalHost(hostname)) return false
  const canonical = publicHost(env)
  if (!canonical) return false
  return hostname !== canonical
}
