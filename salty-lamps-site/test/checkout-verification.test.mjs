import test from 'node:test'
import assert from 'node:assert/strict'
import { paidCheckoutSummary } from '../functions/api/checkout/verify.js'

test('checkout confirmation requires a complete paid session created by this shop', () => {
  const paid = {
    id: 'cs_test_1234567890abcdef',
    created: 1789830000,
    status: 'complete',
    payment_status: 'paid',
    metadata: { store: 'salty-lamps' },
    customer_details: { email: 'asim@example.com', name: 'Asim', address: { city: 'Stoke-on-Trent', postal_code: 'ST4 3NP' } },
    amount_subtotal: 3796,
    amount_total: 4495,
    total_details: { amount_shipping: 699 },
    shipping_cost: { amount_total: 699, shipping_rate: { display_name: 'Tracked delivery' } },
    line_items: { data: [{
      id: 'li_1',
      description: 'Himalayan salt bowl — 6\" Dia',
      quantity: 2,
      amount_total: 2998,
      price: { unit_amount: 1499, product: { metadata: { sku_id: '94' } } },
    }] },
  }
  assert.deepEqual(paidCheckoutSummary(paid, {
    imagesBySkuId: new Map([[94, '/media/bowl.webp']]),
    emailDelivery: { status: 'sent', to: 'asim@example.com' },
  }), {
    status: 'paid',
    orderReference: '#90ABCDEF',
    placedAt: '2026-09-19T15:00:00.000Z',
    customerEmail: 'asim@example.com',
    delivery: { name: 'Asim', city: 'Stoke-on-Trent', postcode: 'ST4 3NP', service: 'Tracked delivery' },
    emailDelivery: { status: 'sent', to: 'asim@example.com' },
    items: [{
      id: 'li_1', skuId: 94, name: 'Himalayan salt bowl — 6\" Dia', quantity: 2,
      unitPricePence: 1499, totalPence: 2998, image: '/media/bowl.webp',
    }],
    totals: { itemsPence: 3796, deliveryPence: 699, totalPence: 4495 },
  })
  assert.equal(paidCheckoutSummary({ ...paid, payment_status: 'unpaid' }), null)
  assert.equal(paidCheckoutSummary({ ...paid, status: 'open' }), null)
  assert.equal(paidCheckoutSummary({ ...paid, metadata: {} }), null)
  assert.equal(paidCheckoutSummary(null), null)
})
