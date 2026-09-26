import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/checkout.js'
import { commerceFixture } from './helpers/commerce-fixture.mjs'

const address = { email: 'buyer@example.com', name: 'Example Buyer', line1: '10 High Street', line2: '', city: 'Stoke-on-Trent', postcode: 'ST4 3NP' }

test('checkout snapshots trusted database weights, not client weights or costs', async () => {
  const previous = globalThis.fetch
  let sent
  let sequence = 0
  globalThis.fetch = async (request, init) => {
    if (String(request).endsWith('/v1/customers')) return new Response(JSON.stringify({ id: 'cus_test_checkout' }), { headers: { 'content-type': 'application/json' } })
    sent = new URLSearchParams(init?.body ?? (await request.text()))
    return new Response(
      JSON.stringify({
        id: `cs_test_${++sequence}`,
        client_secret: 'cs_test_secret_fixture',
        expires_at: Math.floor(Date.now()/1000)+1800,
      }),
      { headers: { 'content-type': 'application/json' } },
    )
  }
  try {
    const row = {
      id: 1,
      sku: 'ONE',
      name: 'Lamp',
      variant_label: 'Small',
      price_pence: 1000,
      track_mode: 'binary',
      in_stock: 1,
      product_weight_min_g: 2000,
      product_weight_max_g: 3000,
      packed_weight_g: 3500,
      postal_group: 'Standard',
      weight_public: 1,
    }
    const config = {
      unit: 'kg', show_cards: false, split_parcels: true,
      rates: [{ id: 'standard', group: 'Standard', service: 'Tracked delivery', country: 'GB', postcodes: '', min_g: 0, max_g: 10000, price_pence: 650 }],
    }
    const { db: DB, sql } = commerceFixture()
    sql.prepare("UPDATE skus SET track_mode='binary',in_stock=1 WHERE id=1").run()
    sql.prepare('UPDATE sku_weights SET product_weight_min_g=?,product_weight_max_g=?,packed_weight_g=?,postal_group=?,weight_public=? WHERE sku_id=1').run(row.product_weight_min_g,row.product_weight_max_g,row.packed_weight_g,row.postal_group,row.weight_public)
    sql.prepare("UPDATE settings SET value=? WHERE key='postage_config'").run(JSON.stringify(config))
    for (const quantity of [2, 4, 12]) {
    const result = await onRequestPost({
      env: { DB, STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_PUBLISHABLE_KEY: 'pk_test_fixture' },
      request: new Request('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            { skuId: 1, quantity, packed_weight_g: 1, price_pence: 1 },
          ],
          postcode: address.postcode,
          address,
        }),
      }),
    })
    assert.equal(result.status, 200)
    assert.equal(
      sent.get(
        'line_items[0][price_data][product_data][metadata][packed_weight_g]',
      ),
      '3500',
    )
    assert.equal(sent.get('line_items[0][price_data][unit_amount]'), '1000')
    assert.equal(sent.get('line_items[0][quantity]'), String(quantity))
    assert.match(
      sent.get('line_items[0][price_data][product_data][description]'),
      /2–3 kg/,
    )
    assert.equal(sent.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), String(Math.ceil(quantity / 2) * 650))
    assert.equal(sent.get('shipping_options[0][shipping_rate_data][display_name]'), 'Tracked delivery')
    assert.equal(sent.get('metadata[store]'), 'salty-lamps')
    assert.equal(sent.get('payment_method_types[0]'), 'card')
    assert.equal(sent.get('wallet_options[link][display]'), 'never')
    assert.equal(sent.get('customer'), 'cus_test_checkout')
    assert.equal(sent.get('ui_mode'), 'embedded')
    assert.equal(sent.get('redirect_on_completion'), 'if_required')
    assert.equal(sent.get('success_url'), null)
    assert.match(sent.get('return_url'), /\/checkout\/success\?session_id=/)
    }
  } finally {
    globalThis.fetch = previous
  }
})

test('checkout creates postcode-specific delivery options from the selected postcode', async () => {
  const previous = globalThis.fetch
  let sent
  let customer
  globalThis.fetch = async (request, init) => {
    if (String(request).endsWith('/v1/customers')) {
      customer = new URLSearchParams(init?.body ?? (await request.text()))
      return new Response(JSON.stringify({ id: 'cus_test_postcode' }), { headers: { 'content-type': 'application/json' } })
    }
    sent = new URLSearchParams(init?.body ?? (await request.text()))
    return new Response(JSON.stringify({ id: 'cs_test_postcode', client_secret: 'cs_test_secret_fixture', expires_at: Math.floor(Date.now()/1000)+1800 }), {
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const row = {
      id: 1,
      sku: 'ONE',
      name: 'Lamp',
      variant_label: 'Small',
      price_pence: 1000,
      track_mode: 'binary',
      in_stock: 1,
      product_weight_min_g: 2000,
      product_weight_max_g: 3000,
      packed_weight_g: 3500,
      postal_group: 'Standard',
      weight_public: 1,
    }
    const config = {
      unit: 'kg',
      show_cards: false,
      split_parcels: true,
      rates: [{ id: 'stoke', group: 'Standard', service: 'Stoke delivery', country: 'GB', postcodes: 'ST4', min_g: 0, max_g: 10000, price_pence: 450 }],
    }
    const { db: DB, sql } = commerceFixture()
    sql.prepare("UPDATE skus SET track_mode='binary',in_stock=1 WHERE id=1").run()
    sql.prepare('UPDATE sku_weights SET product_weight_min_g=?,product_weight_max_g=?,packed_weight_g=?,postal_group=?,weight_public=? WHERE sku_id=1').run(row.product_weight_min_g,row.product_weight_max_g,row.packed_weight_g,row.postal_group,row.weight_public)
    sql.prepare("UPDATE settings SET value=? WHERE key='postage_config'").run(JSON.stringify(config))
    const result = await onRequestPost({
      env: { DB, STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_PUBLISHABLE_KEY: 'pk_test_fixture' },
      request: new Request('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ items: [{ skuId: 1, quantity: 1 }], postcode: 'ST4 3NP', address }),
      }),
    })
    assert.equal(result.status, 200)
    assert.equal(sent.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '450')
    assert.equal(sent.get('shipping_options[0][shipping_rate_data][display_name]'), 'Stoke delivery')
    assert.equal(customer.get('shipping[address][postal_code]'), 'ST4 3NP')
    assert.equal(customer.get('shipping[address][country]'), 'GB')
    assert.equal(customer.get('shipping[address][line1]'), '10 High Street')
    assert.equal(sent.get('customer'), 'cus_test_postcode')
    assert.equal(sent.get('shipping_address_collection[allowed_countries][0]'), null)
    assert.equal(sent.get('payment_intent_data[shipping][address][postal_code]'), 'ST4 3NP')
    const data = await result.json()
    assert.equal(data.clientSecret, 'cs_test_secret_fixture')
    assert.equal(data.publishableKey, 'pk_test_fixture')
  } finally {
    globalThis.fetch = previous
  }
})

test('checkout rejects a delivery postcode that differs from the address', async () => {
  const result = await onRequestPost({
    env: {},
    request: new Request('http://localhost/api/checkout', { method: 'POST', body: JSON.stringify({ postcode: 'SW1A 1AA', address, items: [] }) }),
  })
  assert.equal(result.status, 400)
  assert.match((await result.json()).error, /postcode changed/i)
})
