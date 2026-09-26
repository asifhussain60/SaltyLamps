import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import Stripe from 'stripe'
import { commerceFixture, fixtureAddress, fixtureRequest } from './helpers/commerce-fixture.mjs'
import { onRequestPost as webhook } from '../functions/api/webhook.js'
import { onRequestPost as enquiry } from '../functions/api/support/enquiry.js'
import { loadEmailConfig } from '../functions/lib/mailer.mjs'
import { CONTENT_QUERIES, CONTENT_QUERY_KEYS, shapeContent } from '../functions/lib/content-queries.mjs'

const setupSql = fs.readFileSync(new URL('../d1/staging/production-email-settings.sql', import.meta.url), 'utf8')
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })

test('staged business routing keeps sending disabled and the Hotmail inbox private', async () => {
  const { sql, db } = commerceFixture()
  try {
    sql.exec(setupSql)
    sql.exec(setupSql)
    const config = await loadEmailConfig({ DB: db })
    assert.equal(config.adminEmail, 'Saltylamps@hotmail.com')
    assert.equal(config.fromAddress, 'orders@saltylamps.co.uk')
    assert.equal(config.enabled, false)
    const contactQuery = CONTENT_QUERIES[CONTENT_QUERY_KEYS.indexOf('contact')]
    const content = JSON.stringify(shapeContent({ contact: sql.prepare(contactQuery).all() }))
    assert.doesNotMatch(content, /hotmail\.com/i)
    assert.match(content, /info@saltylamps\.co\.uk/)
  } finally { sql.close() }
})

test('paid order and enquiry route customer mail and business alerts separately without duplicate order mail', async () => {
  const { sql, db } = commerceFixture()
  const priorFetch = globalThis.fetch
  const deliveries = []
  const env = { DB: db, STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture', RESEND_API_KEY: 're_fixture' }
  try {
    sql.exec(setupSql)
    // Only this in-memory fixture sends into a fully mocked transport.
    sql.exec("UPDATE settings SET value='1' WHERE key='email_enabled'")
    globalThis.fetch = async (url, init) => {
      const target = new URL(String(url))
      if (target.href === 'https://api.resend.com/emails') {
        deliveries.push(JSON.parse(init.body))
        return json({ id: `mail_fixture_${deliveries.length}` })
      }
      assert.equal(target.hostname, 'api.stripe.com')
      if (target.pathname.endsWith('/line_items')) return json({ data: [{ quantity: 1, price: { unit_amount: 1000, product: { metadata: { sku_id: '1' } } } }], has_more: false })
      return json({ latest_charge: { payment_method_details: { type: 'card' } } })
    }
    const session = { id: 'cs_test_email_routing', payment_intent: 'pi_fixture', status: 'complete', payment_status: 'paid', metadata: { store: 'salty-lamps' }, customer_details: { email: fixtureAddress.email }, amount_total: 1500, currency: 'gbp' }
    const payload = JSON.stringify({ id: 'evt_email_routing', type: 'checkout.session.completed', data: { object: session } })
    const request = () => new Request('http://localhost/api/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET }) } })
    assert.equal((await webhook({ env, request: request() })).status, 200)
    assert.equal((await webhook({ env, request: request() })).status, 200)
    assert.equal(deliveries.length, 2)
    const customer = deliveries.find(mail => mail.to[0] === fixtureAddress.email)
    const business = deliveries.find(mail => mail.to[0] === 'Saltylamps@hotmail.com')
    assert.ok(customer)
    assert.ok(business)
    assert.deepEqual(customer.to, [fixtureAddress.email])
    assert.deepEqual(customer.reply_to, ['info@saltylamps.co.uk'])
    assert.deepEqual(business.reply_to, [fixtureAddress.email])
    assert.ok(deliveries.every(mail => mail.from === 'Salty Lamps <orders@saltylamps.co.uk>'))
    assert.equal((await enquiry({ env, request: fixtureRequest('/api/support/enquiry', { source: 'trade', name: 'Fixture Buyer', email: fixtureAddress.email, message: 'Synthetic routing check only.' }) })).status, 200)
    assert.equal(deliveries.length, 3)
    assert.deepEqual(deliveries[2].to, ['Saltylamps@hotmail.com'])
    assert.deepEqual(deliveries[2].reply_to, [fixtureAddress.email])
    const outbox = sql.prepare('SELECT template_key,to_address,status FROM email_outbox ORDER BY template_key').all().map(row => ({ ...row }))
    assert.deepEqual(outbox, [
      { template_key: 'admin_enquiry_trade', to_address: 'Saltylamps@hotmail.com', status: 'sent' },
      { template_key: 'admin_new_order', to_address: 'Saltylamps@hotmail.com', status: 'sent' },
      { template_key: 'order_confirmation', to_address: fixtureAddress.email, status: 'sent' },
    ])
  } finally { globalThis.fetch = priorFetch; sql.close() }
})
