import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { migrationPlan, migrationMarkdown, pricingMarkdown } from '../src/admin/docs/migration-plan.mjs'
import { paymentDecisionMarkdown } from '../src/admin/docs/payment-decision.mjs'

test('Wix archive schema stays outside production migrations until the catalogue decision', () => {
  const migrations = fs.readdirSync(new URL('../d1/migrations/', import.meta.url))
  assert.ok(!migrations.some(name => /wix/i.test(name)))
  assert.ok(fs.existsSync(new URL('../d1/staging/wix-business-records.sql', import.meta.url)))
  assert.match(migrationMarkdown(), /before any live schema change or import/i)
})

test('owner migration instructions and Markdown cannot diverge', () => {
  assert.equal(fs.readFileSync(new URL('../docs/migration.md', import.meta.url), 'utf8'), migrationMarkdown())
  assert.equal(fs.readFileSync(new URL('../docs/pricing.md', import.meta.url), 'utf8'), pricingMarkdown())
  assert.equal(fs.readFileSync(new URL('../docs/payment-decision.md', import.meta.url), 'utf8'), paymentDecisionMarkdown())
})

test('migration gates protect access, money, existing mail and rollback', () => {
  const ids = migrationPlan.phases.map(p => p.id)
  assert.ok(ids.indexOf('protect') < ids.indexOf('import'))
  assert.ok(ids.indexOf('rehearse') < ids.indexOf('cutover'))
  assert.ok(ids.indexOf('backup') < ids.indexOf('provision'))
  assert.match(migrationMarkdown(), /STRIPE_PUBLISHABLE_KEY/)
  assert.match(migrationMarkdown(), /Zoho/)
  assert.match(migrationMarkdown(), /freeze/i)
  assert.match(migrationMarkdown(), /pending/i)
  const checks = migrationPlan.phases.flatMap(p => p.checks.map((_, i) => `${p.id}-${i}`))
  assert.equal(new Set(checks).size, checks.length)
  assert.ok(migrationPlan.phases.every(p => p.gate && p.owner))
})

test('the migration plan names the approved owner and administrator and prohibits the retired account', () => {
  const plan = migrationMarkdown()
  assert.match(plan, /Saltylamps@hotmail\.com is the approved owner account/i)
  assert.match(plan, /Asifhussain60@gmail\.com signed in to that account and appears as an Active member/i)
  assert.match(plan, /asifhussain60@hotmail\.com.*retired and prohibited/i)
  assert.match(plan, /entire-account policy lists Administrator and Super Administrator - All Privileges/i)
  assert.match(plan, /empty EU-jurisdiction D1 database was created there, establishing that resource-creation action only/i)
  assert.match(plan, /Shop administrator Access sign-in.*remain open/i)
})
