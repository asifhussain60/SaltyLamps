import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  PROTECTED_TABLES, STOCK_IMPACT_SQL, assertCutoff, assertDeleteOnly, deleteStatements, summarySql, targets,
} from '../scripts/clear-sandbox-lib.mjs'
import { assertReadOnlySql } from '../scripts/read-only-sql.mjs'

// The shop's real shape: the base schema, then every migration in order. Three migrations
// re-add columns the base schema already has or seed catalogue rows that trip a constraint;
// only those two kinds of error are tolerated, because they do not affect the tables tested here.
const TOLERATED = /duplicate column name|CHECK constraint failed/
function applyAll(db) {
  db.exec(fs.readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8'))
  for (const file of fs.readdirSync(new URL('../d1/migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    try { db.exec(fs.readFileSync(new URL(`../d1/migrations/${file}`, import.meta.url), 'utf8')) } catch (error) {
      if (!TOLERATED.test(error.message)) throw error
    }
  }
}
const CUTOFF = '2026-10-01 12:00:00'

// A real SQLite database with the shop's own schema and foreign keys switched ON, holding
// a sandbox history, a real (live) order that must survive, and the owner's catalogue.
function shop() {
  const db = new DatabaseSync(':memory:')
  applyAll(db)
  db.exec(`INSERT INTO products(id,name,slug) VALUES('p','Lamp','lamp');
    INSERT INTO skus(id,sku,product_id,price_pence,track_mode,quantity,in_stock) VALUES(1,'ONE','p',1000,'quantity',5,1);
    INSERT INTO sku_weights(sku_id,packed_weight_g,postal_group) VALUES(1,1000,'Standard');
    INSERT INTO reviews(id,name,quote) VALUES('r-keep','A','Lovely');
    INSERT INTO admin_audit(actor_email,action,entity) VALUES('o@x','product.save','product');`)
  for (const [id, status] of [['cs_test_1', 'paid'], ['cs_test_2', 'refunded'], ['cs_live_1', 'paid']]) {
    db.exec(`INSERT INTO orders(id,status,created_at) VALUES('${id}','${status}','2026-09-28 10:00:00');
      INSERT INTO order_items(order_id,sku_id,quantity,unit_price_pence) VALUES('${id}',1,2,1000);
      INSERT INTO order_item_weights(order_id,sku_id,packed_weight_g,postal_group,weight_public) VALUES('${id}',1,1000,'Standard',1);
      INSERT INTO order_refunds(order_id,refund_id,status,amount_pence,attempt) VALUES('${id}','re_${id}','succeeded',100,1);
      INSERT INTO order_refund_records(refund_id,order_id,status,amount_pence) VALUES('re_${id}','${id}','succeeded',100);
      INSERT INTO order_notification_jobs(order_id,payload) VALUES('${id}','{}');
      INSERT INTO commerce_email_jobs(id,order_id,payload,status) VALUES('job-${id}','${id}','{}','sent');
      INSERT INTO email_outbox(template_key,to_address,subject,status,order_id,payload) VALUES('order','b@x','s','sent','${id}','{}');`)
  }
  db.exec(`INSERT INTO commerce_email_envelopes(job_id,transport_json) SELECT id,'{}' FROM commerce_email_jobs;
    INSERT INTO commerce_email_reconciliations(job_id,generation) SELECT id,1 FROM commerce_email_jobs;
    INSERT INTO checkout_reservations(session_id,address_json,expires_at,status) VALUES('cs_test_9','{}',1,'released'),('cs_live_9','{}',1,'active');
    INSERT INTO checkout_reservation_items(session_id,sku_id,quantity) VALUES('cs_test_9',1,1),('cs_live_9',1,1);
    INSERT INTO checkout_attempts(id,fingerprint,parameters_json,rows_json,address_json,session_id,created_at) VALUES
      ('a1','f1','{}','[]','{}','cs_test_1','2026-09-28 10:00:00'),('a2','f2','{}','[]','{}','cs_live_1','2026-10-02 10:00:00'),
      ('a3','f3','{}','[]','{}',NULL,'2026-09-28 10:00:00'),('a4','f4','{}','[]','{}',NULL,'2026-10-03 10:00:00');
    INSERT INTO email_outbox(template_key,to_address,subject,status,payload,created_at) VALUES
      ('test','o@x','template test','sent','{}','2026-09-28 11:00:00'),('order','real@x','after launch','sent','{}','2026-10-03 11:00:00');
    INSERT INTO enquiries(source,name,email,message,created_at) VALUES('c','T','t@x','test','2026-09-28 10:00:00'),('c','R','r@x','real','2026-10-03 10:00:00');
    INSERT INTO admin_save_requests(request_id,actor_email,fingerprint,result_json,created_at) VALUES('r1','o@x','f','{}','2026-09-28 10:00:00');`)
  db.exec('PRAGMA foreign_keys = ON')
  return db
}
const count = (db, table, where = '1=1') => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get().n
const run = (db, options) => { for (const sql of deleteStatements({ cutoff: CUTOFF, ...options })) db.exec(sql) }

test('the clean-up removes every sandbox order and its children, and nothing real', () => {
  const db = shop()
  run(db, {})
  assert.equal(count(db, 'orders', "id LIKE 'cs_test_%'"), 0)
  assert.equal(count(db, 'orders', "id = 'cs_live_1'"), 1, 'the live order survives')
  for (const table of ['order_items', 'order_item_weights', 'order_refunds', 'order_refund_records', 'order_notification_jobs', 'commerce_email_jobs']) {
    assert.equal(count(db, table), 1, `${table} keeps only the live order's row`)
  }
  assert.equal(count(db, 'commerce_email_envelopes'), 1)
  assert.equal(count(db, 'commerce_email_reconciliations'), 1)
  assert.equal(count(db, 'checkout_reservations'), 1)
  assert.equal(count(db, 'checkout_reservation_items', "session_id = 'cs_live_9'"), 1)
  assert.equal(count(db, 'checkout_attempts', "id IN ('a2','a4')"), 2, 'live and post-cutoff attempts survive')
  assert.equal(count(db, 'checkout_attempts', "id IN ('a1','a3')"), 0)
})

test('emails: sandbox and pre-cutoff test sends go, the live order email and later mail stay', () => {
  const db = shop()
  run(db, {})
  assert.equal(count(db, 'email_outbox', "to_address = 'real@x'"), 1)
  assert.equal(count(db, 'email_outbox', "template_key = 'test'"), 0)
  assert.equal(count(db, 'email_outbox', "order_id = 'cs_live_1'"), 1)
})

test('the catalogue, stock, prices, weights, reviews and audit history are never touched', () => {
  const db = shop()
  const before = Object.fromEntries(PROTECTED_TABLES.filter(t => { try { count(db, t); return true } catch { return false } }).map(t => [t, count(db, t)]))
  const stock = db.prepare('SELECT quantity FROM skus WHERE id=1').get().quantity
  run(db, { includeEnquiries: true, includeSaveRequests: true })
  for (const [table, n] of Object.entries(before)) assert.equal(count(db, table), n, `${table} unchanged`)
  assert.equal(db.prepare('SELECT quantity FROM skus WHERE id=1').get().quantity, stock, 'stock is reported, never edited')
})

test('enquiries and admin save requests are kept unless the operator opts in', () => {
  const db = shop()
  run(db, {})
  assert.equal(count(db, 'enquiries'), 2)
  assert.equal(count(db, 'admin_save_requests'), 1)
  run(db, { includeEnquiries: true, includeSaveRequests: true })
  assert.equal(count(db, 'enquiries', "email = 'r@x'"), 1, 'a later real enquiry survives')
  assert.equal(count(db, 'enquiries', "email = 't@x'"), 0)
  assert.equal(count(db, 'admin_save_requests'), 0)
})

test('running it twice changes nothing the second time', () => {
  const db = shop()
  run(db, {})
  const snapshot = ['orders', 'order_items', 'email_outbox', 'checkout_attempts'].map(t => count(db, t))
  run(db, {})
  assert.deepEqual(['orders', 'order_items', 'email_outbox', 'checkout_attempts'].map(t => count(db, t)), snapshot)
})

test('the summary counts agree with what the deletes remove, and flag unclassifiable orders', () => {
  const db = shop()
  const before = db.prepare(summarySql({ cutoff: CUTOFF })).get()
  assert.equal(before.del_orders, 2)
  assert.equal(before.live_orders, 1)
  assert.equal(before.unknown_orders, 0)
  db.exec("INSERT INTO orders(id,status) VALUES('odd-id','paid')")
  assert.equal(db.prepare(summarySql({ cutoff: CUTOFF })).get().unknown_orders, 1)
})

test('the stock report shows what sandbox orders consumed, separately for paid and refunded', () => {
  const db = shop()
  const [row] = db.prepare(STOCK_IMPACT_SQL).all()
  assert.equal(row.in_paid_test_orders, 2)
  assert.equal(row.in_refunded_test_orders, 2)
})

test('only plain DELETEs from the listed tables and read-only queries can be sent', () => {
  const opts = { cutoff: CUTOFF }
  assert.doesNotThrow(() => assertDeleteOnly(deleteStatements(opts), opts))
  assert.throws(() => assertDeleteOnly(['DELETE FROM products WHERE 1=1'], opts), /allowed DELETE/)
  assert.throws(() => assertDeleteOnly(['UPDATE skus SET quantity = 0'], opts), /allowed DELETE/)
  assert.throws(() => assertDeleteOnly(["DELETE FROM orders WHERE id LIKE 'cs_test_%'; DROP TABLE orders"], opts), /more than one/)
  assert.doesNotThrow(() => assertReadOnlySql([summarySql(opts), STOCK_IMPACT_SQL]))
  assert.equal(targets(opts).at(-1).table, 'orders', 'orders are deleted last')
  assert.throws(() => assertCutoff('yesterday'), /UTC time/)
  assert.throws(() => assertCutoff("2026-10-01 12:00:00'; DROP TABLE orders; --"), /UTC time/)
})
