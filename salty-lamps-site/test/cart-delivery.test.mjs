import test from 'node:test'
import assert from 'node:assert/strict'
import { normaliseCart, readCheckoutCart } from '../functions/lib/cart.mjs'
import { quotePostage, validatePostageConfig } from '../functions/lib/weights.mjs'
import { reconcilePurchasedCart } from '../src/content/cart-session.mjs'
import { isPaidShopCheckoutEvent } from '../functions/api/webhook.js'
import { isAdminOpenHost } from '../functions/lib/admin-hosts.mjs'
import { flattenProductRows } from '../functions/lib/flatten-products.mjs'
import { onRequestPost as estimateDelivery } from '../functions/api/checkout/delivery.js'

const rate = { id: 'standard', service: 'Tracked', group: 'Standard', country: 'GB', postcodes: '', min_g: 0, max_g: 10000, price_pence: 650 }
const config = { unit: 'kg', show_cards: false, split_parcels: true, rates: [rate] }
const line = { packed_weight_g: 3500, postal_group: 'Standard', quantity: 1 }
const quote = (lines, overrides = {}) => quotePostage(lines, { ...config, ...overrides }, { country: 'GB' })

test('numbered adjoining tariff bands follow the whole basket across quantities and mixed products', () => {
  const bands = { unit: 'kg', show_cards: false, rates: [
    [0,200,350], [200,1000,399], [1000,3000,599], [3000,12000,699], [12000,30000,799], [30000,60000,1599],
  ].map(([min_g,max_g,price_pence],i) => ({ ...rate, id:String(i+1), group:String(i+1), min_g,max_g,price_pence })) }
  for (const [quantity, price] of [[2,699],[4,799],[12,1599]]) {
    const result = quotePostage([{ ...line, packed_weight_g:5000, postal_group:'4', quantity }], bands, {country:'GB'})
    assert.equal(result.status, 'ready')
    assert.equal(result.options[0].price_pence, price)
  }
  assert.equal(quotePostage([{...line,packed_weight_g:5000,postal_group:'4'}, {...line,packed_weight_g:200,postal_group:''}],bands,{country:'GB'}).options[0].price_pence,699)
  assert.equal(quotePostage([{...line,packed_weight_g:null}],bands,{country:'GB'}).status,'needs_review')
  assert.equal(quotePostage([{...line,packed_weight_g:60001}],bands,{country:'GB'}).status,'needs_review')
  assert.equal(quotePostage([line],bands,{country:'FR'}).status,'needs_review')
  const named = {...bands,rates:bands.rates.map(r=>({...r,group:`Group ${r.group}`}))}
  assert.equal(quotePostage([line],named,{country:'GB'}).status,'needs_review')
})

test('delivery response does not expose internal catalogue gaps or invent a charge', async () => {
  const rows = [{id:94,name:'Salt bowl',variant_label:'6 inch',packed_weight_g:null}, {id:90,name:'Shot glass',packed_weight_g:null}]
    .map(row=>({...row,quantity:20,price_pence:1000,track_mode:'quantity'}))
  const DB={prepare:()=>({bind:()=>({}),first:async()=>({value:JSON.stringify(config)})}),batch:async()=>rows.map(row=>({results:[row]}))}
  const response=await estimateDelivery({env:{DB},request:new Request('http://localhost/api/checkout/delivery',{method:'POST',body:JSON.stringify({items:[{skuId:94,quantity:2},{skuId:90,quantity:2}]})})})
  const data=await response.json()
  assert.equal(data.status,'needs_review')
  assert.deepEqual(data.options,[])
  assert.equal(data.message,'We could not prepare delivery for this order. Please try again.')
  assert.equal('itemsNeedingDelivery' in data,false)
  assert.doesNotMatch(JSON.stringify(data),/Salt bowl|Shot glass|packed weight/i)
})

test('2, 4 and 12 whole lamps automatically use 1, 2 and 6 parcels', () => {
  for (const [quantity, weight, parcels, cost] of [[2,7000,1,650], [4,14000,2,1300], [12,42000,6,3900]]) {
    const result = quote([{ ...line, quantity }])
    assert.equal(result.status, 'ready')
    assert.equal(result.total_weight_g, weight)
    assert.equal(result.options[0].parcel_count, parcels)
    assert.equal(result.options[0].price_pence, cost)
  }
})
test('single heavy items cannot be split and missing tariffs or weights never become free delivery', () => {
  for (const lines of [[{ ...line, packed_weight_g: 11000 }], [{ ...line, packed_weight_g: null }], [{ ...line, postal_group: '' }]]) {
    assert.equal(quote(lines).status, 'needs_review')
  }
  assert.equal(quote([{ ...line, quantity: 4 }], { split_parcels: false }).status, 'needs_review')
  assert.equal(quote([line], { rates: [] }).status, 'needs_review')
  assert.equal(quote([line], { rates: [{ ...rate, postcodes: 'SW1' }] }).status, 'needs_review')
})
test('parcel calculation preserves whole packs and prices each group separately', () => {
  const result = quote([{ ...line, packed_weight_g: 6000, quantity: 3 }])
  assert.equal(result.options[0].parcel_count, 3, '18 kg is three indivisible 6 kg items, not two 9 kg parcels')
  const mixed = quote([line, { ...line, postal_group: 'Fragile', quantity: 2 }], { rates: [rate, { ...rate, id: 'fragile', group: 'Fragile', price_pence: 900 }] })
  assert.equal(mixed.options[0].price_pence, 1550)
  assert.equal(mixed.options[0].parcel_count, 2)
})
test('larger approved weight bands take precedence and unmatched band gaps are not guessed', () => {
  const rates = [rate, { ...rate, id: 'heavy', min_g: 10000, max_g: 20000, price_pence: 1000 }]
  assert.equal(quote([{ ...line, quantity: 4 }], { rates }).options[0].price_pence, 1000)
  assert.equal(quote([line], { rates: [{ ...rate, min_g: 5000 }] }).status, 'needs_review')
  assert.throws(() => validatePostageConfig({ ...config, split_parcels: 'yes' }))
})
test('duplicate cart lines merge before stock checking and malformed quantities are rejected', async () => {
  assert.deepEqual(normaliseCart([{ skuId: 1, quantity: 2 }, { skuId: 1, quantity: 2 }]), [{ skuId: 1, quantity: 4 }])
  for (const quantity of [0, -1, 1.5, '2', null, 10000, Infinity]) assert.throws(() => normaliseCart([{ skuId: 1, quantity }]))
  const db = { prepare: sql => { assert.match(sql, /p.visible = 1/); return { bind: () => ({}) } }, batch: async () => [{ results: [{ id: 1, name: 'Lamp', price_pence: 1000, track_mode: 'quantity', quantity: 3 }] }] }
  await assert.rejects(() => readCheckoutCart(db, [{ skuId: 1, quantity: 2 }, { skuId: 1, quantity: 2 }]), /only 3/)
})
test('bulk stock availability is no longer capped at twenty', () => {
  const [product] = flattenProductRows([{ product_id: 'p1', sku_id: 1, name: 'Bricks', slug: 'bricks', track_mode: 'quantity', quantity: 2000, price_pence: 500 }])
  assert.equal(product.stockQty, 2000)
})
test('payment reconciliation preserves other items and additional quantities', () => {
  const cart = [{ product: { skuId: 1 }, qty: 14 }, { product: { skuId: 2 }, qty: 3 }]
  const result = reconcilePurchasedCart(cart, [{ skuId: 1, quantity: 12 }])
  assert.equal(result[0].qty, 2)
  assert.equal(result[1].qty, 3)
})
test('only paid sessions from this shop create orders, including delayed payment success', () => {
  const event = { type: 'checkout.session.completed', data: { object: { status: 'complete', payment_status: 'paid', metadata: { store: 'salty-lamps' } } } }
  assert.equal(isPaidShopCheckoutEvent(event), true)
  assert.equal(isPaidShopCheckoutEvent({ ...event, type: 'checkout.session.async_payment_succeeded' }), true)
  assert.equal(isPaidShopCheckoutEvent({ ...event, data: { object: { ...event.data.object, payment_status: 'unpaid' } } }), false)
  assert.equal(isPaidShopCheckoutEvent({ ...event, data: { object: { ...event.data.object, metadata: {} } } }), false)
})
test('the real storefront cannot be configured as a sign-in-free owner portal', () => {
  assert.equal(isAdminOpenHost('shop.example', { PUBLIC_HOST: 'shop.example', ADMIN_OPEN_HOSTS: 'shop.example' }), false)
  assert.equal(isAdminOpenHost('salty-lamps-proposal.pages.dev', {
    PUBLIC_HOST: 'www.saltylamps.co.uk', SITE_URL: 'https://salty-lamps-proposal.pages.dev',
    ADMIN_OPEN_HOSTS: 'salty-lamps-proposal.pages.dev',
  }), true)
})

test('customer references from the payment page, email and older links all find the same order', async () => {
  const { DatabaseSync } = await import('node:sqlite')
  const { findOrder } = await import('../functions/api/support/refund-request.js')
  const { paidCheckoutSummary } = await import('../functions/api/checkout/verify.js')
  const sql = new DatabaseSync(':memory:')
  sql.exec("CREATE TABLE orders(id TEXT,customer_email TEXT); INSERT INTO orders VALUES('cs_test_1234567890abcdef','buyer@example.invalid')")
  const db = { prepare: query => ({ bind: (...args) => ({ first: async () => sql.prepare(query).get(...args) }) }) }
  const ref = paidCheckoutSummary({ id: 'cs_test_1234567890abcdef', status: 'complete', payment_status: 'paid', metadata: { store: 'salty-lamps' } }).orderReference
  for (const reference of [ref, '567890abcdef', 'cs_test_1234567890abcdef']) assert.ok(await findOrder(db, reference, 'buyer@example.invalid'))
  assert.equal(await findOrder(db, ref, 'someone-else@example.invalid'), undefined)
  sql.close()
})

test('spreadsheet exports preserve customer text without evaluating it as a formula', async () => {
  const { toCsv } = await import('../functions/lib/admin-helpers.mjs')
  const csv = toCsv([{ name: '=HYPERLINK("https://example.invalid")', amount: -12 }, { name: '\t+1+1', amount: 2 }], [{ key: 'name', label: 'Name' }, { key: 'amount', label: 'Amount' }])
  assert.ok(csv.includes("\"'=HYPERLINK"))
  assert.ok(csv.includes("'\t+1+1"))
  assert.ok(csv.includes(',-12'))
})
