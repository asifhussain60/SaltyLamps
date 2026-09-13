import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/checkout.js'

test('checkout snapshots trusted database weights, not client weights or costs', async () => {
  const previous = globalThis.fetch
  let sent
  globalThis.fetch = async (request, init) => {
    sent = new URLSearchParams(init?.body ?? (await request.text()))
    return new Response(
      JSON.stringify({
        id: 'cs_test',
        url: 'https://checkout.example.invalid/test',
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
      unit: 'kg', show_cards: false,
      rates: [{ id: 'standard', group: 'Standard', service: 'Tracked delivery', country: 'GB', postcodes: '', min_g: 0, max_g: 10000, price_pence: 650 }],
    }
    const DB = { prepare: sql => {
      const first = async () => sql.includes("key='postage_config'") ? { value: JSON.stringify(config) } : row
      return { first, bind: () => ({ first }) }
    } }
    const result = await onRequestPost({
      env: { DB, STRIPE_SECRET_KEY: 'sk_test_fixture' },
      request: new Request('http://localhost/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            { skuId: 1, quantity: 2, packed_weight_g: 1, price_pence: 1 },
          ],
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
    assert.equal(sent.get('line_items[0][quantity]'), '2')
    assert.match(
      sent.get('line_items[0][price_data][product_data][description]'),
      /2–3 kg/,
    )
    assert.equal(sent.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '650')
    assert.equal(sent.get('shipping_options[0][shipping_rate_data][display_name]'), 'Tracked delivery')
    assert.equal(sent.get('metadata[store]'), 'salty-lamps')
  } finally {
    globalThis.fetch = previous
  }
})
