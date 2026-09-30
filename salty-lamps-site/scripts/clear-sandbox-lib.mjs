// What "clear the sandbox records" means, as data, so the rules can be tested against a
// real SQLite database and cannot drift from the script that runs them.
//
// THE RULE THAT MAKES THIS SAFE: an order's id is the Stripe Checkout session id, and Stripe
// test-mode sessions start "cs_test_" while live ones start "cs_live_". Everything deleted is
// tied to a cs_test_ order (or is a leftover with no order, older than a cutoff the operator
// supplies). A real order can never match, so this is safe to run even after launch.
//
// KEPT, always: products, options, stock, prices, packed weights, categories, collections,
// content, reviews, settings, postcodes, email templates, images, and the audit history.
// Stock is never edited here; the dry run reports what the test orders consumed so the owner
// can decide.

export const TEST_SESSION = "'cs_test_%'"
const TEST_ORDERS = `SELECT id FROM orders WHERE id LIKE ${TEST_SESSION}`
const TEST_JOBS = `SELECT id FROM commerce_email_jobs WHERE order_id IN (${TEST_ORDERS})`

const CUTOFF = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
export function assertCutoff(cutoff) {
  if (!CUTOFF.test(String(cutoff || ''))) throw new Error('The cutoff must be a UTC time like "2026-10-01 12:00:00".')
  return cutoff
}

// Order matters: a row is deleted before anything its WHERE clause looks up, so every child
// goes before the orders they point at, and `orders` is last.
export function targets({ cutoff, includeEnquiries = false, includeSaveRequests = false }) {
  assertCutoff(cutoff)
  const list = [
    { table: 'commerce_email_reconciliations', where: `job_id IN (${TEST_JOBS})` },
    { table: 'commerce_email_envelopes', where: `job_id IN (${TEST_JOBS})` },
    { table: 'commerce_email_jobs', where: `order_id IN (${TEST_ORDERS})` },
    { table: 'order_notification_jobs', where: `order_id IN (${TEST_ORDERS})` },
    { table: 'order_refund_records', where: `order_id IN (${TEST_ORDERS})` },
    { table: 'order_refunds', where: `order_id IN (${TEST_ORDERS})` },
    { table: 'order_postage', where: `order_id IN (${TEST_ORDERS})` },
    { table: 'order_item_weights', where: `order_id IN (${TEST_ORDERS})` },
    { table: 'order_items', where: `order_id IN (${TEST_ORDERS})` },
    { table: 'email_outbox', where: `order_id IN (${TEST_ORDERS}) OR (order_id IS NULL AND created_at <= '${cutoff}')` },
    { table: 'checkout_reservation_items', where: `session_id IN (SELECT session_id FROM checkout_reservations WHERE session_id LIKE ${TEST_SESSION})` },
    { table: 'checkout_reservations', where: `session_id LIKE ${TEST_SESSION}` },
    { table: 'checkout_attempts', where: `session_id LIKE ${TEST_SESSION} OR (session_id IS NULL AND created_at <= '${cutoff}')` },
  ]
  if (includeEnquiries) list.push({ table: 'enquiries', where: `created_at <= '${cutoff}'` })
  if (includeSaveRequests) list.push({ table: 'admin_save_requests', where: `created_at <= '${cutoff}'` })
  list.push({ table: 'orders', where: `id LIKE ${TEST_SESSION}` })
  return list
}

export const deleteStatements = options => targets(options).map(t => `DELETE FROM ${t.table} WHERE ${t.where}`)

export const PROTECTED_TABLES = [
  'products', 'skus', 'sku_weights', 'categories', 'collections', 'content_pages', 'content_snippets',
  'reviews', 'settings', 'uk_postcodes', 'email_templates', 'product_images', 'sku_images', 'admin_audit',
]

// One row: how many rows each target would remove, how many protected rows exist, and how many
// orders are neither test nor live (which must stop the run, because the rule cannot classify them).
export function summarySql(options) {
  const parts = targets(options).map(t => `(SELECT COUNT(*) FROM ${t.table} WHERE ${t.where}) AS del_${t.table}`)
  const kept = PROTECTED_TABLES.map(t => `(SELECT COUNT(*) FROM ${t} ) AS keep_${t}`)
  const unknown = "(SELECT COUNT(*) FROM orders WHERE id NOT LIKE 'cs_test_%' AND id NOT LIKE 'cs_live_%') AS unknown_orders"
  const live = "(SELECT COUNT(*) FROM orders WHERE id LIKE 'cs_live_%') AS live_orders"
  return `SELECT ${[...parts, ...kept, unknown, live].join(', ')}`
}

// What the test orders took out of stock, per option, so the owner can confirm opening counts.
export const STOCK_IMPACT_SQL = `SELECT s.sku AS sku, p.name AS product, s.quantity AS stock_now,
  SUM(CASE WHEN o.status = 'paid' THEN oi.quantity ELSE 0 END) AS in_paid_test_orders,
  SUM(CASE WHEN o.status IN ('refunded', 'cancelled') THEN oi.quantity ELSE 0 END) AS in_refunded_test_orders
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id AND o.id LIKE ${TEST_SESSION}
  JOIN skus s ON s.id = oi.sku_id
  JOIN products p ON p.id = s.product_id
  GROUP BY s.id ORDER BY p.name, s.sku`

// The only statements the apply step may send: a plain DELETE from a table this module lists.
export function assertDeleteOnly(statements, options) {
  const allowed = new Set(targets(options).map(t => t.table))
  for (const statement of statements) {
    const match = /^DELETE FROM (\w+) WHERE /.exec(statement)
    if (!match || !allowed.has(match[1])) throw new Error(`Refusing a statement that is not an allowed DELETE: ${statement.slice(0, 70)}`)
    if (statement.includes(';')) throw new Error('Refusing a statement with more than one command.')
  }
  return statements
}
