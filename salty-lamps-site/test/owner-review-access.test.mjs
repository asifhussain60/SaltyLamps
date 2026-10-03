import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateKeyPairSync, sign } from 'node:crypto'
import { onRequest as page } from '../functions/_middleware.js'
import { onRequest as api } from '../functions/api/admin/_middleware.js'
import { LAUNCH_CHECKS } from '../functions/lib/launch-review.mjs'
import { ownerReviewHref } from '../src/admin/store-url.mjs'

// A local signing key and mocked key service simulate Asim's claims through the
// real verifier. No token is sent to Cloudflare; live policy tests are separate.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'owner-review-fixture', alg: 'RS256', use: 'sig' }
const issuer = 'https://owner-review-fixture.invalid'
const env = { ADMIN_HOSTS: 'admin.saltylamps.co.uk', PUBLIC_HOST: 'www.saltylamps.co.uk', SITE_URL: 'https://www.saltylamps.co.uk', ACCESS_TEAM_DOMAIN: 'owner-review-fixture.invalid', ACCESS_AUD: 'owner-review-fixture' }
const source = readFileSync(new URL('../src/admin/AdminApp.jsx', import.meta.url), 'utf8')
const nav = source.split('const NAV = [')[1].split('const TITLES =')[0]
const navPaths = [...nav.matchAll(/href: '([^']+)'/g)].map(match => match[1])
const linkedPaths = [...new Set([...navPaths, ...LAUNCH_CHECKS.map(check => check.path).filter(Boolean)])]
const claims = { iss: issuer, aud: [env.ACCESS_AUD], email: 'saltylamps@hotmail.com', exp: Math.floor(Date.now() / 1000) + 600 }
function token(overrides = {}) {
  const segment = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${segment({ alg: 'RS256', kid: jwk.kid })}.${segment({ ...claims, ...overrides })}`
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`
}
function context(url, headers = {}) {
  const data = {}
  return { request: new Request(url, { headers }), env, data, next: async () => new Response(data.actorEmail || 'shop page') }
}

test('every owner-review link stays on an approved protected host', () => {
  assert.ok(navPaths.length >= 16)
  for (const path of linkedPaths) {
    const resolved = new URL(ownerReviewHref(path, 'admin.saltylamps.co.uk'), 'https://admin.saltylamps.co.uk')
    assert.equal(resolved.hostname, path.startsWith('/admin') ? 'admin.saltylamps.co.uk' : 'test.saltylamps.co.uk', path)
    assert.equal(resolved.pathname, path)
  }
  assert.equal(ownerReviewHref('/shop', 'localhost'), '/shop')
})

test('simulated Asim token passes every administrator link; invalid tokens fail closed', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, `${issuer}/cdn-cgi/access/certs`)
    return Response.json({ keys: [jwk] })
  })
  const valid = token()
  for (const path of linkedPaths.filter(path => path.startsWith('/admin'))) {
    for (const headers of [{ 'Cf-Access-Jwt-Assertion': valid }, { Cookie: `CF_Authorization=${valid}` }]) {
      const response = await page(context(`https://admin.saltylamps.co.uk${path}`, headers))
      assert.equal(response.status, 200, path)
      assert.equal(await response.text(), claims.email, path)
      assert.match(response.headers.get('cache-control'), /private/)
    }
    for (const invalid of [null, token({ exp: 1 }), token({ aud: ['wrong-app'] }), token({ iss: 'https://wrong.invalid' }), valid.slice(0, -12) + 'AAAAAAAAAAAA']) {
      const response = await page(context(`https://admin.saltylamps.co.uk${path}`, invalid ? { Cookie: `CF_Authorization=${invalid}` } : {}))
      assert.equal(response.status, 401, path)
    }
  }
  for (const path of ['/api/admin/launch-review', '/api/admin/products', '/api/admin/orders', '/api/admin/settings', '/api/admin/inventory', '/api/admin/emails/outbox']) {
    const response = await api(context(`https://admin.saltylamps.co.uk${path}`, { 'Cf-Access-Jwt-Assertion': valid }))
    assert.equal(response.status, 200, path)
    assert.equal(await response.text(), claims.email)
  }
})
