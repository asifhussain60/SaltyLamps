// Where the admin exists, and where it does not.
//
// The first test is the most important one in this file: it is the guarantee that
// deploying the host split ahead of the cutover changes nothing at all.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  adminSplitConfigured, hostMatches, isAdminHost, isLocalHost,
  primaryAdminHost, publicHost, shouldDiscourageIndexing,
} from '../functions/lib/admin-hosts.mjs'

test('with ADMIN_HOSTS unset, the admin is served exactly where it always was', () => {
  assert.equal(isAdminHost('www.saltylamps.co.uk', {}), true)
  assert.equal(isAdminHost('salty-lamps-proposal.pages.dev', {}), true)
  assert.equal(adminSplitConfigured({}), false)
  assert.equal(adminSplitConfigured({ ADMIN_HOSTS: '   ' }), false)
})

test('with ADMIN_HOSTS set, only that hostname serves the admin', () => {
  const env = { ADMIN_HOSTS: 'admin.saltylamps.co.uk' }
  assert.equal(isAdminHost('admin.saltylamps.co.uk', env), true)
  assert.equal(isAdminHost('www.saltylamps.co.uk', env), false)
  assert.equal(isAdminHost('saltylamps.co.uk', env), false)
  assert.equal(adminSplitConfigured(env), true)
})

test('a laptop always reaches the admin, whatever the variable says', () => {
  // Otherwise setting ADMIN_HOSTS in .dev.vars would break local development, and
  // someone would "fix" it by removing the split.
  const env = { ADMIN_HOSTS: 'admin.saltylamps.co.uk' }
  for (const host of ['localhost', '127.0.0.1', 'admin.localhost']) {
    assert.equal(isAdminHost(host, env), true, host)
    assert.equal(isLocalHost(host), true, host)
  }
})

test('a leading dot matches subdomains, which is what covers preview deployments', () => {
  assert.equal(hostMatches('abc123.salty-lamps.pages.dev', '.salty-lamps.pages.dev'), true)
  assert.equal(hostMatches('salty-lamps.pages.dev', '.salty-lamps.pages.dev'), false)
  assert.equal(hostMatches('WWW.SaltyLamps.co.uk', 'www.saltylamps.co.uk'), true)
})

test('a redirect target is never a wildcard pattern', () => {
  // '.pages.dev' matches hosts; it is not somewhere a browser can be sent.
  assert.equal(primaryAdminHost({ ADMIN_HOSTS: '.pages.dev,admin.saltylamps.co.uk' }), 'admin.saltylamps.co.uk')
  assert.equal(primaryAdminHost({ ADMIN_HOSTS: '.pages.dev' }), null)
  assert.equal(primaryAdminHost({}), null)
})

test('the canonical host comes from PUBLIC_HOST, or from SITE_URL', () => {
  assert.equal(publicHost({ SITE_URL: 'https://www.saltylamps.co.uk' }), 'www.saltylamps.co.uk')
  assert.equal(publicHost({ SITE_URL: 'https://www.saltylamps.co.uk', PUBLIC_HOST: 'saltylamps.co.uk' }), 'saltylamps.co.uk')
  assert.equal(publicHost({}), null)
})

test('duplicates are hidden from search engines and the real shop never is', () => {
  const env = { SITE_URL: 'https://www.saltylamps.co.uk' }
  assert.equal(shouldDiscourageIndexing('salty-lamps.pages.dev', env), true)
  assert.equal(shouldDiscourageIndexing('admin.saltylamps.co.uk', env), true)
  assert.equal(shouldDiscourageIndexing('www.saltylamps.co.uk', env), false)
})

test('when the canonical host is unknown, nothing is noindexed', () => {
  // Guessing wrong here would de-index the actual shop, which is the one failure
  // in this file that could not be undone in an afternoon.
  assert.equal(shouldDiscourageIndexing('www.saltylamps.co.uk', {}), false)
  assert.equal(shouldDiscourageIndexing('anything.example', {}), false)
  assert.equal(shouldDiscourageIndexing('localhost', { SITE_URL: 'https://www.saltylamps.co.uk' }), false)
})
