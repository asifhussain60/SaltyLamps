import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { PRODUCTS_QUERY, flattenProductRows } from '../functions/lib/flatten-products.mjs'
import { buildCollectionSections } from '../functions/lib/section-rules.mjs'
import { onRequest as protect } from '../functions/api/admin/_middleware.js'

function fixture() {
  const sql = new DatabaseSync(':memory:')
  for (const file of ['schema.sql', 'migrations/009-option-images.sql', 'migrations/011-product-weights.sql', 'migrations/017-product-intro.sql']) {
    sql.exec(fs.readFileSync(new URL(`../d1/${file}`, import.meta.url), 'utf8'))
  }
  const wrap = (query, args = []) => ({
    bind: (...values) => wrap(query, values),
    first: async () => sql.prepare(query).get(...args) || null,
    all: async () => ({ results: sql.prepare(query).all(...args) }),
    run: async () => {
      const statement = sql.prepare(query)
      if (statement.columns().length) return { results: statement.all(...args) }
      return { meta: { changes: Number(statement.run(...args).changes) } }
    },
  })
  const db = { prepare: query => wrap(query), batch: async statements => {
    sql.exec('BEGIN')
    try { const results = []; for (const s of statements) results.push(await s.run()); sql.exec('COMMIT'); return results }
    catch (e) { sql.exec('ROLLBACK'); throw e }
  } }
  const add = (id, name, visible = 1) => {
    sql.prepare('INSERT INTO products(id,name,visible,categories) VALUES(?,?,?,?)').run(id, name, visible, 'salt-lamps')
    sql.prepare("INSERT INTO skus(product_id,sku,price_pence,track_mode,in_stock) VALUES(?,?,1000,'binary',1)").run(id, id)
  }
  add('a', 'Apple holder'); add('f', 'Frames'); add('n', 'Natural lamp'); add('h', 'Hidden lamp', 0)
  const read = async () => (await import('../functions/api/admin/products/order.js')).onRequestGet({ env: { DB: db } })
  const save = async (body, raw = false) => (await import('../functions/api/admin/products/order.js')).onRequestPut({
    env: { DB: db }, data: { actorEmail: 'owner@example.invalid' },
    request: new Request('http://localhost/api/admin/products/order', { method: 'PUT', body: raw ? body : JSON.stringify(body) }),
  })
  const payload = (productIds = ['n', 'f', 'a', 'h'], revision = '') => ({ productIds, revision, requestId: crypto.randomUUID() })
  const publicIds = () => [...new Set(flattenProductRows(sql.prepare(PRODUCTS_QUERY).all()).map(p => p.productId))]
  return { sql, db, add, read, save, payload, publicIds }
}

test('preferred ordering persists without altering owner data; hidden items never reach the shop', async () => {
  const f = fixture()
  const before = f.sql.prepare('SELECT * FROM products ORDER BY id').all()
  const initial = await (await f.read()).json()
  assert.deepEqual(initial.products.map(p => p.id), ['a', 'f', 'h', 'n'])
  const body = f.payload()
  const result = await f.save(body)
  assert.equal(result.status, 200)
  assert.equal((await result.json()).revision, body.requestId)
  assert.deepEqual((await (await f.read()).json()).products.map(p => p.id), body.productIds)
  assert.deepEqual(f.publicIds(), ['n', 'f', 'a'])
  assert.deepEqual(f.sql.prepare('SELECT * FROM products ORDER BY id').all(), before)
  assert.equal(f.sql.prepare('SELECT count(*) n FROM admin_audit').get().n, 1)
  f.add('new', 'A new product')
  assert.deepEqual(f.publicIds(), ['n', 'f', 'a', 'new'])
  f.sql.exec("UPDATE products SET visible=1 WHERE id='h'")
  assert.deepEqual(f.publicIds(), ['n', 'f', 'a', 'h', 'new'])
})

test('duplicate, missing, foreign and invalid IDs are refused without any write', async () => {
  const f = fixture()
  for (const ids of [['a', 'a', 'n', 'h'], ['a'], ['a', 'f', 'n', 'foreign'], ['a', 'f', 'n', 1], null]) {
    assert.ok([400, 409].includes((await f.save(f.payload(ids))).status))
  }
  assert.equal((await f.save(null)).status, 400)
  assert.equal((await f.save('{', true)).status, 400)
  assert.equal((await f.save({ ...f.payload(), requestId: '' })).status, 400)
  assert.equal(f.sql.prepare("SELECT count(*) n FROM settings WHERE key='product_display_order'").get().n, 0)
  assert.equal(f.sql.prepare('SELECT count(*) n FROM admin_audit').get().n, 0)
})

test('stale saves and catalog changes cannot replace a newer order; response retries are idempotent', async () => {
  const f = fixture(), first = f.payload()
  assert.equal((await f.save(first)).status, 200)
  assert.equal((await f.save(first)).status, 200)
  assert.equal(f.sql.prepare('SELECT count(*) n FROM admin_audit').get().n, 1)
  assert.equal((await f.save(f.payload(['f', 'a', 'n', 'h']))).status, 409)
  assert.equal((await f.save({ ...first, productIds: ['f', 'a', 'n', 'h'] })).status, 409)
  f.add('new', 'New product')
  assert.equal((await f.save(f.payload(first.productIds, first.requestId))).status, 409)
  assert.deepEqual(f.publicIds(), ['n', 'f', 'a', 'new'])
  const next = f.payload(['new', 'f', 'a', 'n', 'h'], first.requestId)
  assert.equal((await f.save(next)).status, 200)
  assert.equal((await f.save(first)).status, 409)
})

test('save and audit roll back together on failure', async () => {
  const f = fixture()
  f.sql.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
  assert.equal((await f.save(f.payload())).status, 500)
  assert.equal(f.sql.prepare("SELECT count(*) n FROM settings WHERE key='product_display_order'").get().n, 0)
  assert.deepEqual(f.publicIds(), ['a', 'f', 'n'])
})

test('variants stay together, deleted products disappear and build query matches customer response', async () => {
  const f = fixture()
  f.sql.exec("INSERT INTO skus(product_id,sku,price_pence,track_mode,in_stock) VALUES('n','n2',2000,'binary',1)")
  await f.save(f.payload())
  const rows = flattenProductRows(f.sql.prepare(PRODUCTS_QUERY).all())
  assert.deepEqual(rows.map(p => p.productId), ['n', 'n', 'f', 'a'])
  const { onRequestGet } = await import('../functions/api/products.js')
  const response = await onRequestGet({ env: { DB: f.db } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual((await response.json()).products.map(p => p.productId), rows.map(p => p.productId))
  f.sql.exec("DELETE FROM skus WHERE product_id='f'; DELETE FROM products WHERE id='f'")
  assert.deepEqual(f.publicIds(), ['n', 'a'])
})

test('collections preserve the chosen sequence even when the first product is unavailable', () => {
  const items = [{ id: 'first', stock: false }, { id: 'second', stock: true }]
  assert.deepEqual(buildCollectionSections([], items)[0].groups[0].products, items)
})

test('product ordering endpoints remain behind administrator authentication and host protection', async () => {
  let reached = false
  for (const method of ['GET', 'PUT']) {
    for (const hostname of ['admin.example.com', 'shop.example.com']) {
      const response = await protect({ request: new Request(`https://${hostname}/api/admin/products/order`, { method }),
        env: { ADMIN_HOSTS: 'admin.example.com' }, data: {}, next: async () => { reached = true; return new Response('unsafe') } })
      assert.ok([401, 403, 404, 503].includes(response.status))
      assert.equal(reached, false)
    }
  }
})
