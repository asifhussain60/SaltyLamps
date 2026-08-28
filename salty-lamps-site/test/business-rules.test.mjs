// Two rules that decide whether the owner is told the right things, and whether a
// catalogue import can be trusted. Both were written to be testable; neither had
// a test until now.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lowStockMessages } from '../functions/api/webhook.js'
import { readInventory, readWixExport } from '../scripts/lib/wix-catalogue.mjs'

const config = { lowStockAlerts: true, adminEmail: 'owner@example.com', siteUrl: 'https://shop.example' }
const sku = (id, quantity, over = {}) => [id, {
  name: 'Angel Lamp', sku: 'RSL-A', variant_label: 'Small', track_mode: 'quantity', quantity, ...over,
}]

test('a low-stock alert fires on the crossing, and only on the crossing', () => {
  const before = new Map([sku(1, 6)])
  assert.equal(lowStockMessages(before, new Map([[1, 2]]), 5, config).length, 1, '6 -> 4 crosses 5')
  assert.equal(lowStockMessages(before, new Map([[1, 1]]), 5, config).length, 0, '6 -> 5 does not')
})

test('an already-low item does not alert again on every subsequent order', () => {
  // This is what stops the owner being emailed on every sale of a slow-moving
  // line until they stop reading the alerts altogether.
  assert.equal(lowStockMessages(new Map([sku(1, 3)]), new Map([[1, 1]]), 5, config).length, 0)
})

test('items the shop does not count never alert', () => {
  const before = new Map([sku(1, null, { track_mode: 'binary' })])
  assert.equal(lowStockMessages(before, new Map([[1, 9]]), 5, config).length, 0)
})

test('the alert carries what the owner needs, and where to act on it', () => {
  const [msg] = lowStockMessages(new Map([sku(1, 6)]), new Map([[1, 3]]), 5, config)
  assert.equal(msg.templateKey, 'admin_low_stock')
  assert.equal(msg.to, 'owner@example.com')
  assert.equal(msg.data.quantity, '3')
  assert.equal(msg.data.sku, 'RSL-A')
  assert.equal(msg.data.ctaHref, 'https://shop.example/admin/inventory')
})

test('turning alerts off turns them off entirely', () => {
  assert.deepEqual(
    lowStockMessages(new Map([sku(1, 6)]), new Map([[1, 5]]), 5, { ...config, lowStockAlerts: false }),
    [],
  )
})

test('stock is never reported below zero', () => {
  // Possible when two orders land together and the second is larger than what is
  // left. "Remaining: -3" in an email reads as a broken shop.
  const [msg] = lowStockMessages(new Map([sku(1, 6)]), new Map([[1, 99]]), 5, config)
  assert.equal(msg.data.quantity, '0')
})

// ---------------------------------------------------------------------------

test('a Wix inventory column decides how the shop tracks the item', () => {
  assert.deepEqual(readInventory('InStock'), { track_mode: 'binary', quantity: null, in_stock: 1 })
  assert.deepEqual(readInventory('OutOfStock'), { track_mode: 'binary', quantity: null, in_stock: 0 })
  assert.deepEqual(readInventory('12'), { track_mode: 'quantity', quantity: 12, in_stock: 1 })
  assert.deepEqual(readInventory('0'), { track_mode: 'quantity', quantity: 0, in_stock: 0 })
})

const DQ = String.fromCharCode(34)
const csv = rows => rows.map(r => r.map(v => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? DQ + s.split(DQ).join(DQ + DQ) + DQ : s
}).join(',')).join('\n')

const HEADER = ['handleId', 'fieldType', 'name', 'description', 'productImageUrl', 'collection',
  'sku', 'price', 'visible', 'inventory', 'productOptionDescription1', 'productOptionDescription2']

test('a product with variants becomes one product with several', () => {
  const { products } = readWixExport(csv([
    HEADER,
    ['p1', 'Product', 'Angel Lamp', '<p>Nice</p>', 'a.jpg', 'Salt Lamps', '', '29.99', 'true', '5', '', ''],
    ['p1', 'Variant', '', '', '', '', 'RSL-A', '29.99', '', '5', 'Small', ''],
    ['p1', 'Variant', '', '', '', '', 'RSL-B', '39.99', '', 'OutOfStock', 'Large', ''],
  ]))
  assert.equal(products.length, 1)
  assert.equal(products[0].skus.length, 2)
  assert.equal(products[0].skus[0].price_pence, 2999)
  assert.equal(products[0].skus[1].in_stock, 0)
  assert.equal(products[0].description, 'Nice', 'HTML should be stripped')
})

test('a product with no variants is its own single variant', () => {
  const { products } = readWixExport(csv([
    HEADER,
    ['p2', 'Product', 'Bulb', '', 'b.jpg', 'Accessories', 'E14-1', '3.50', 'true', 'InStock', '', ''],
  ]))
  assert.equal(products[0].skus.length, 1)
  assert.equal(products[0].skus[0].sku, 'E14-1')
  assert.equal(products[0].skus[0].price_pence, 350)
})

test('a name containing a comma and a quote survives the round trip', () => {
  // Both appear in the real catalogue, and both defeat a naive split on commas.
  const { products } = readWixExport(csv([
    HEADER,
    ['p3', 'Product', 'Bowl, 6" Dia', '', 'c.jpg', 'Salt Lamps', 'SB-03', '14.99', 'true', '20', '', ''],
  ]))
  assert.equal(products[0].name, 'Bowl, 6" Dia')
})

test('a file re-saved by a spreadsheet is called out, not silently misread', () => {
  const { warnings } = readWixExport(csv([HEADER, ['p4', 'Product', 'Short row']]))
  assert.ok(warnings.some(w => /altered since Wix wrote it/.test(w)), warnings.join('\n'))
})

test('an orders export imported by mistake is refused with a useful message', () => {
  const { products, warnings } = readWixExport('Order Number,Date,Total\n1001,2026-01-01,29.99')
  assert.equal(products.length, 0)
  assert.ok(warnings.some(w => /Products rather than Orders/.test(w)), warnings.join('\n'))
})

test('a Wix collection this site has no page for is reported, never invented', () => {
  const { products, warnings } = readWixExport(csv([
    HEADER,
    ['p5', 'Product', 'Mystery', '', 'd.jpg', 'Brand New Range', 'M-1', '9.99', 'true', '1', '', ''],
  ]))
  assert.equal(products[0].categories, 'all-products')
  assert.ok(warnings.some(w => /no category on this site/.test(w)), warnings.join('\n'))
})
