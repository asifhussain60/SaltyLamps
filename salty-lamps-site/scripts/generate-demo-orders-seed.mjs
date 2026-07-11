// Generates d1/demo-orders-seed.sql — a year of realistic dummy ORDERS for local testing
// (Dashboard, Reports, Orders search/filter/pagination). Reads real SKU codes straight out of
// d1/seed.sql so the demo data never drifts from the actual catalog. Never touches
// products/skus — mirrors the boundary d1/seed.sql itself documents in the other direction.
//
// Every order id is prefixed `demo_order_`, which can never collide with a real Stripe checkout
// session id (those look like `cs_live_...` / `cs_test_...`), so demo data is always trivially
// identifiable and can be cleanly removed with d1/reset-demo-orders.sql before going live.
//
// Usage:
//   node scripts/generate-demo-orders-seed.mjs
//   wrangler d1 execute salty-lamps-db --local --file=d1/demo-orders-seed.sql
//
// LOCAL/TESTING USE ONLY — never run the generated file with --remote.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedPath = resolve(__dirname, '../d1/seed.sql')
const outPath = resolve(__dirname, '../d1/demo-orders-seed.sql')

const seedSql = readFileSync(seedPath, 'utf8')
const skuCodes = [...seedSql.matchAll(/INSERT INTO skus \(sku,.*?\) VALUES \('([^']+)'/g)].map(m => m[1])
if (skuCodes.length === 0) {
  console.error('No SKU codes found in d1/seed.sql — nothing to generate against.')
  process.exit(1)
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Priya', 'Sam', 'Tara', 'Umar', 'Vic']
const LAST_NAMES = ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Wood', 'Clarke', 'Patel', 'Kaur', 'Khan', 'Hughes', 'Edwards', 'Morgan', 'Lewis']
const CITIES = [
  ['Leeds', 'LS1 4AP'], ['York', 'YO1 7PR'], ['Hull', 'HU1 3DY'], ['Sheffield', 'S1 2HE'],
  ['Manchester', 'M1 3AB'], ['Bristol', 'BS1 4ST'], ['Birmingham', 'B1 1AA'], ['Nottingham', 'NG1 5FS'],
  ['Newcastle upon Tyne', 'NE1 7RU'], ['Liverpool', 'L1 8JQ'],
]
const STREETS = ['Salt Rd', 'Lamp St', 'Crystal Ave', 'Rock Way', 'Glow Gardens', 'Amber Close', 'Himalaya Court']

const NUM_CUSTOMERS = 180
const customers = Array.from({ length: NUM_CUSTOMERS }, (_, i) => {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  return { email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`, name: `${first} ${last}` }
})

const DAYS = 365
const today = new Date()

function isoDaysAgo(daysAgo, hour, minute) {
  const d = new Date(today)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

const lines = []
let orderSeq = 0

for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
  const date = new Date(today)
  date.setDate(date.getDate() - daysAgo)
  const dow = date.getDay() // 0 Sun .. 6 Sat
  const month = date.getMonth() // 0-11
  const weekendBoost = dow === 0 || dow === 6 ? 1.3 : 1
  const seasonBoost = month === 10 || month === 11 ? 1.6 : 1 // Nov/Dec bump
  const baseRate = 1.1 * weekendBoost * seasonBoost
  const ordersToday = Math.max(0, Math.round(baseRate + (Math.random() - 0.5) * 1.4))

  for (let n = 0; n < ordersToday; n++) {
    orderSeq += 1
    const id = `demo_order_${String(orderSeq).padStart(4, '0')}`
    const customer = pick(customers)
    const [city, postcode] = pick(CITIES)
    const createdAt = isoDaysAgo(daysAgo, randInt(8, 20), randInt(0, 59))

    const statusRoll = Math.random()
    const status = statusRoll < 0.90 ? 'paid' : statusRoll < 0.95 ? 'refunded' : statusRoll < 0.98 ? 'pending' : 'cancelled'

    let fulfilment = 'unfulfilled'
    if (status === 'paid') {
      if (daysAgo > 10) fulfilment = 'delivered'
      else if (daysAgo > 5) fulfilment = pick(['delivered', 'shipped'])
      else if (daysAgo > 2) fulfilment = pick(['shipped', 'packed'])
      else fulfilment = pick(['packed', 'unfulfilled', 'unfulfilled'])
    }
    const tracking = fulfilment === 'shipped' || fulfilment === 'delivered' ? `TRK${randInt(100000, 999999)}GB` : null
    const shippedAt = tracking ? isoDaysAgo(Math.max(daysAgo - 1, 0), randInt(9, 17), randInt(0, 59)) : null

    lines.push(
      'INSERT INTO orders (id, payment_intent, status, customer_email, amount_total_pence, currency, created_at, '
      + 'fulfilment_status, tracking_number, shipped_at, ship_name, ship_line1, ship_city, ship_postcode, ship_country) VALUES '
      + `('${id}', 'pi_demo_${orderSeq}', '${status}', '${customer.email}', 0, 'gbp', '${createdAt}', '${fulfilment}', `
      + `${tracking ? `'${tracking}'` : 'NULL'}, ${shippedAt ? `'${shippedAt}'` : 'NULL'}, '${customer.name}', `
      + `'${randInt(1, 99)} ${pick(STREETS)}', '${city}', '${postcode}', 'GB');`,
    )

    const itemCount = randInt(1, 3)
    const usedSkus = new Set()
    for (let it = 0; it < itemCount; it++) {
      const sku = pick(skuCodes)
      if (usedSkus.has(sku)) continue
      usedSkus.add(sku)
      const qty = randInt(1, 3)
      lines.push(
        `INSERT INTO order_items (order_id, sku_id, quantity, unit_price_pence) `
        + `SELECT '${id}', id, ${qty}, price_pence FROM skus WHERE sku = '${sku}' LIMIT 1;`,
      )
    }
  }
}

const header = `-- Generated by scripts/generate-demo-orders-seed.mjs — do not hand-edit, re-run the script instead.
--
-- A year of realistic dummy ORDERS for local testing (Dashboard, Reports, Orders). Never touches
-- products/skus. Every id is prefixed 'demo_order_' so it can never collide with a real Stripe
-- checkout session id, and can be cleanly removed with d1/reset-demo-orders.sql before go-live.
--
-- LOCAL/TESTING USE ONLY — never run this file with --remote.
-- Apply:  wrangler d1 execute salty-lamps-db --local --file=d1/demo-orders-seed.sql
-- Reset:  wrangler d1 execute salty-lamps-db --local --file=d1/reset-demo-orders.sql
`

const totalsBackfill = `
-- Backfill totals from the actually-inserted line items (real prices, resolved at apply-time),
-- so revenue on the dashboard/reports always matches the order-items breakdown exactly.
UPDATE orders SET amount_total_pence = (
  SELECT COALESCE(SUM(oi.quantity * oi.unit_price_pence), 0) FROM order_items oi WHERE oi.order_id = orders.id
) WHERE id LIKE 'demo_order_%';
`

writeFileSync(outPath, `${header}\n${lines.join('\n')}\n${totalsBackfill}`)
console.log(`Wrote ${outPath} — ${orderSeq} demo orders across ${DAYS + 1} days.`)
