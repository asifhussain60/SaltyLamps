import test from 'node:test'
import assert from 'node:assert/strict'
import { paidCheckoutSummary } from '../functions/api/checkout/verify.js'

test('checkout confirmation requires a complete paid session created by this shop', () => {
  const paid = {
    id: 'cs_test_1234567890abcdef',
    status: 'complete',
    payment_status: 'paid',
    metadata: { store: 'salty-lamps' },
  }
  assert.deepEqual(paidCheckoutSummary(paid), {
    status: 'paid',
    orderReference: '567890abcdef',
  })
  assert.equal(paidCheckoutSummary({ ...paid, payment_status: 'unpaid' }), null)
  assert.equal(paidCheckoutSummary({ ...paid, status: 'open' }), null)
  assert.equal(paidCheckoutSummary({ ...paid, metadata: {} }), null)
  assert.equal(paidCheckoutSummary(null), null)
})
