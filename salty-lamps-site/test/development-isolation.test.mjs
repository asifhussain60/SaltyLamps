import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onRequest } from '../functions/_middleware.js'
import { environmentMismatch } from '../functions/lib/environment-guard.mjs'

const env = {
  DEPLOYMENT_ENV: 'development',
  DB: { prepare: () => ({ first: async () => ({ value: 'development' }) }) },
  IMAGES: { get: async () => ({ text: async () => JSON.stringify({
    environment: 'development', bucket: 'salty-lamps-development-images' }) }) },
  DEVELOPMENT_SHARED_HOST: 'test.saltylamps.co.uk', ADMIN_HOSTS: 'test.saltylamps.co.uk',
  SITE_URL: 'https://test.saltylamps.co.uk', PUBLIC_HOST: 'www.saltylamps.co.uk',
  STRIPE_TEST_ONLY: '1', MAIL_DRY_RUN: 'true', ACCESS_AUD: 'example', ACCESS_TEAM_DOMAIN: 'example',
}
async function visit(host, path, overrides = {}) {
  return onRequest({ request: new Request(`https://${host}${path}`),
    env: { ...env, ...overrides }, data: {}, next: async () => new Response('served') })
}
test('development storefront works on the test host and remains excluded from search', async () => {
  for (const path of ['/', '/shop', '/api/products', '/checkout/address']) {
    const response = await visit('test.saltylamps.co.uk', path)
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get('x-robots-tag'), /noindex/)
  }
})
test('development cannot be used through Pages aliases or the live hosts', async () => {
  for (const host of ['salty-lamps-development.pages.dev', 'hash.salty-lamps-development.pages.dev',
    'www.saltylamps.co.uk', 'admin.saltylamps.co.uk']) {
    for (const path of ['/', '/api/products', '/api/admin/orders', '/api/checkout', '/api/webhook']) {
      assert.equal((await visit(host, path)).status, 404)
    }
  }
})
test('sharing development shop and admin never removes the Access gate', async () => {
  assert.equal((await visit('test.saltylamps.co.uk', '/admin')).status, 401)
})
test('missing sandbox safeguards fail closed instead of sharing the live admin host', async () => {
  for (const overrides of [{ STRIPE_TEST_ONLY: '' }, { MAIL_DRY_RUN: '' },
    { SITE_URL: 'https://www.saltylamps.co.uk' }, { ADMIN_HOSTS: 'admin.saltylamps.co.uk' }]) {
    assert.equal((await visit('test.saltylamps.co.uk', '/', overrides)).status, 404)
  }
})

test('a development release bound to the live database refuses reads and writes', async () => {
  const DB = { prepare: () => ({ first: async () => null }) }
  for (const path of ['/', '/api/products', '/api/checkout', '/api/admin/products']) {
    const response = await visit('test.saltylamps.co.uk', path, { DB })
    assert.equal(response.status, 503)
  }
})
test('a production release bound to the development database fails closed', async () => {
  assert.equal(await environmentMismatch({ DEPLOYMENT_ENV: 'production', DB: env.DB, IMAGES: env.IMAGES }),
    'Database belongs to another environment')
  assert.equal(await environmentMismatch({ DEPLOYMENT_ENV: 'production',
    DB: { prepare: () => ({ first: async () => null }) }, IMAGES: { get: async () => null } }), null)
})
test('image storage cannot be shared between development and production', async () => {
  assert.ok(await environmentMismatch({ ...env, IMAGES: { get: async () => null } }))
  assert.ok(await environmentMismatch({ DEPLOYMENT_ENV: 'production',
    DB: { prepare: () => ({ first: async () => null }) }, IMAGES: env.IMAGES }))
})
test('provider credentials from the other environment are rejected', async () => {
  for (const credentials of [{ STRIPE_SECRET_KEY: 'sk_live_example' },
    { STRIPE_PUBLISHABLE_KEY: 'pk_live_example' }, { RESEND_API_KEY: 'example' }]) {
    assert.ok(await environmentMismatch({ ...env, ...credentials }))
  }
  assert.ok(await environmentMismatch({ DEPLOYMENT_ENV: 'production', STRIPE_SECRET_KEY: 'sk_test_example' }))
})
test('unavailable database and disabled safeguards cannot permit a mixed release', async () => {
  assert.ok(await environmentMismatch({ ...env, DB: { prepare: () => { throw new Error('offline') } } }))
  assert.ok(await environmentMismatch({ ...env, DEPLOYMENT_ENV: 'production' }))
})

test('missing environment identity is refused', async () => {
  assert.ok(await environmentMismatch({ ...env, DEPLOYMENT_ENV: undefined }))
})
