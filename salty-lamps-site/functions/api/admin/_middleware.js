// Auth gate for every /api/admin/* endpoint.
//
// Placed under functions/api/admin/ so Pages runs it ONLY for the admin API — no
// overhead on the storefront, the public product feed, checkout, webhook, or the
// public image-serve route. It is the first-ever authorization layer in this app.
//
// End state: Cloudflare Access (Zero Trust) fronts /admin and issues a signed JWT.
// This middleware verifies that JWT (RS256, against the team JWKS) and pins the
// application AUD, then exposes the caller's email to downstream handlers via
// context.data.actorEmail for audit logging.
//
// Local dev: set DEV_ADMIN_BYPASS=1 in .dev.vars so `wrangler pages dev` can
// exercise the admin API without an Access token. Setting it anywhere else does
// nothing — see the bypass block in onRequest for why that is now enforced rather
// than merely documented.
//
// Open test site: ADMIN_OPEN_HOSTS names the hostnames — and only those — where the
// admin answers with no sign-in at all. It exists because the test site has to be
// clickable by the owner before Cloudflare Access is set up, and it is deliberately
// a list of hostnames rather than an on/off flag: a flag follows the code to
// production, a hostname does not. When the shop moves to its own domain the list
// will not match it and the admin will be closed there by default, with no one
// having to remember anything.
//
// Separate hostname: ADMIN_HOSTS names where the admin EXISTS, which is a different
// question from who may use it. On any other hostname this API answers 404 before
// it considers a token at all, so the customer-facing domain carries no admin
// surface to probe. The hostname comparisons live in ../../lib/admin-hosts.mjs
// because functions/_middleware.js — which does the same for the /admin HTML — has
// to agree with this file exactly; two copies would eventually disagree, and the
// disagreement would be a door.
//
// Required production secrets (wrangler pages secret put):
//   ACCESS_TEAM_DOMAIN  e.g. "saltylamps" or "saltylamps.cloudflareaccess.com"
//   ACCESS_AUD          the Access application Audience (AUD) tag

import { hostMatches, hostnameOf, isAdminHost, isLocalHost, isTruthy } from '../../lib/admin-hosts.mjs'

const JWKS_TTL_MS = 60 * 60 * 1000 // 1 hour
const jwksCache = new Map() // teamDomain -> { keys, fetchedAt }

// Admin responses must never be stored by a cache — not the edge, not a proxy, not
// the browser. Without this they carry no cache directive at all, and Cloudflare
// will happily serve a previously-authorised 200 to a later unauthenticated caller:
// removing the dev bypass closed sixteen endpoints instantly while the seventeenth
// kept returning a cached copy of the whole catalogue. Applied here rather than in
// each handler so no future endpoint can forget it.
function sealResponse(response) {
  const sealed = new Response(response.body, response)
  sealed.headers.set('cache-control', 'no-store, no-cache, must-revalidate, private')
  sealed.headers.set('pragma', 'no-cache')
  sealed.headers.set('vary', 'Cookie, Cf-Access-Jwt-Assertion')
  return sealed
}

export async function onRequest(context) {
  const { request, env, next, data } = context
  const hostname = hostnameOf(request)

  // --- does the admin exist at this hostname at all? ----------------------
  // Asked first, and answered with 404 rather than 401, because 401 confirms the
  // endpoint is there — and on the customer-facing domain the honest answer is
  // that it is not. Unset ADMIN_HOSTS means "everywhere", which is what this
  // project did before the admin moved to its own subdomain, so a deployment that
  // never sets it behaves exactly as it always has.
  if (!isAdminHost(hostname, env)) {
    return sealResponse(new Response(JSON.stringify({
      error: { code: 'not_found', message: 'Not found.' },
    }), { status: 404, headers: { 'content-type': 'application/json' } }))
  }

  // --- no-sign-in access, scoped to named hostnames ----------------------
  // Trusting a bare on/off flag was a real incident: DEV_ADMIN_BYPASS was set as a
  // production secret on the test site and left there, and this gate honoured it
  // wherever it found it, which served the whole catalogue, the whole order list and
  // the delete and refund routes to anyone who asked. Both doors below are therefore
  // tied to WHERE the request arrived, not just to whether someone set a variable:
  // a flag travels with the code to production, a hostname does not.
  const openAs = openAccessReason(hostname, env)
  if (openAs) {
    data.actorEmail = openAs.actor
    const response = sealResponse(await next())
    // Anything written while the door is open is attributed to a non-person in the
    // audit log, and says so on the wire, so an open deployment is never mistaken
    // for a locked-down one at a glance.
    response.headers.set('x-admin-auth', `open:${openAs.reason}`)
    return response
  }

  // Fail closed if the gate isn't configured — never serve admin data open.
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) {
    return unauthorized('Admin authentication is not configured.', 503)
  }

  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') || readCookie(request, 'CF_Authorization')
  if (!token) return unauthorized('Not signed in.')

  let claims
  try {
    claims = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD)
  } catch (err) {
    return unauthorized(`Access token rejected: ${err.message}`)
  }

  const email = claims.email || claims.identity_nonce || null
  if (!email) return unauthorized('Access token has no identity.')

  data.actorEmail = email
  return sealResponse(await next())
}

// ---------------------------------------------------------------------------

// Why the door is open, or null when it is not. Two ways in, both pinned to the
// hostname the request actually arrived at — see ../../lib/admin-hosts.mjs for why
// that is the load-bearing detail rather than an implementation choice.
function openAccessReason(hostname, env) {
  if (!hostname) return null

  if (isTruthy(env.DEV_ADMIN_BYPASS) && isLocalHost(hostname)) {
    return { reason: 'local', actor: 'dev@localhost' }
  }

  if (hostMatches(hostname, env.ADMIN_OPEN_HOSTS)) {
    return { reason: 'open-host', actor: `no-sign-in@${hostname}` }
  }

  return null
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return null
}

function teamIssuer(teamDomain) {
  const host = teamDomain.includes('.') ? teamDomain : `${teamDomain}.cloudflareaccess.com`
  return `https://${host}`
}

async function getJwks(teamDomain) {
  const cached = jwksCache.get(teamDomain)
  // Date.now() is fine in a Worker (only the workflow scripting sandbox forbids it).
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys

  const url = `${teamIssuer(teamDomain)}/cdn-cgi/access/certs`
  const res = await fetch(url)
  if (!res.ok) throw new Error('could not fetch signing keys')
  const body = await res.json()
  const keys = body.keys || []
  jwksCache.set(teamDomain, { keys, fetchedAt: Date.now() })
  return keys
}

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function decodeSegment(seg) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(seg)))
}

async function verifyAccessJwt(token, teamDomain, expectedAud) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('malformed token')
  const [headerB64, payloadB64, sigB64] = parts

  const header = decodeSegment(headerB64)
  if (header.alg !== 'RS256') throw new Error('unexpected signing algorithm')

  const keys = await getJwks(teamDomain)
  const jwk = keys.find(k => k.kid === header.kid)
  if (!jwk) throw new Error('unknown signing key')

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, base64UrlToBytes(sigB64), signed)
  if (!valid) throw new Error('bad signature')

  const claims = decodeSegment(payloadB64)
  const now = Math.floor(Date.now() / 1000)
  if (claims.exp && now >= claims.exp) throw new Error('token expired')
  if (claims.nbf && now < claims.nbf) throw new Error('token not yet valid')
  if (claims.iss !== teamIssuer(teamDomain)) throw new Error('wrong issuer')

  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(expectedAud)) throw new Error('wrong audience')

  return claims
}

function unauthorized(message, status = 401) {
  return sealResponse(new Response(JSON.stringify({ error: { code: 'unauthorized', message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  }))
}
