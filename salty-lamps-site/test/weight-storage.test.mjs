import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { onRequestPatch } from '../functions/api/admin/skus/[id].js'
import { onRequestPost } from '../functions/api/admin/products/[id]/skus.js'
import { onRequestPatch as bulk } from '../functions/api/admin/weights.js'
import {
  PRODUCTS_QUERY,
  flattenProductRows,
} from '../functions/lib/flatten-products.mjs'
import {
  onRequestPut as savePostage,
  onRequestGet as readPostage,
} from '../functions/api/admin/orders/[id]/postage.js'
function fixture() {
  const sql = new DatabaseSync(':memory:')
  sql.exec(
    fs.readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8'),
  )
  const migration = fs.readFileSync(
    new URL('../d1/migrations/011-product-weights.sql', import.meta.url),
    'utf8',
  )
  sql.exec(migration)
  sql.exec(migration)
  sql.exec(
    "INSERT INTO products(id,name,slug) VALUES('p','Lamp','lamp'); INSERT INTO skus(id,sku,product_id,price_pence,track_mode,in_stock) VALUES(1,'a','p',1000,'binary',1),(2,'b','p',2000,'binary',1);",
  )
  const wrap = (q, args = []) => ({
    bind: (...a) => wrap(q, a),
    first: async () => sql.prepare(q).get(...args),
    all: async () => ({ results: sql.prepare(q).all(...args) }),
    run: async () => {
      const r = sql.prepare(q).run(...args)
      return { meta: { last_row_id: Number(r.lastInsertRowid) } }
    },
  })
  const db = {
    prepare: (q) => wrap(q),
    batch: async (ss) => {
      sql.exec('BEGIN')
      try {
        const rr = []
        for (const s of ss) rr.push(await s.run())
        sql.exec('COMMIT')
        return rr
      } catch (e) {
        sql.exec('ROLLBACK')
        throw e
      }
    },
  }
  return { sql, db }
}
const input = {
  sku: 'a',
  price: 10,
  track_mode: 'binary',
  in_stock: true,
  product_weight_min_g: 2000,
  product_weight_max_g: 3000,
  packed_weight_g: 3500,
  postal_group: 'Standard',
  weight_public: 1,
}
const ctx = (db, body, id = '1') => ({
  env: { DB: db },
  params: { id },
  data: { actorEmail: 'test@example.invalid' },
  request: new Request('http://localhost/api', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
})
test('option weights persist, old updates preserve them, and public output never leaks packed weight', async () => {
  const { db, sql } = fixture()
  assert.equal((await onRequestPatch(ctx(db, input))).status, 200)
  const row = () =>
    sql.prepare('SELECT * FROM sku_weights WHERE sku_id=1').get()
  assert.equal(row()?.packed_weight_g, 3500)
  const {
    product_weight_min_g,
    product_weight_max_g,
    packed_weight_g,
    postal_group,
    weight_public,
    ...old
  } = input
  assert.equal((await onRequestPatch(ctx(db, old))).status, 200)
  assert.equal(row().packed_weight_g, 3500)
  const products = flattenProductRows(sql.prepare(PRODUCTS_QUERY).all())
  assert.equal(products[0].productWeightMaxG, 3000)
  assert.equal(products[0].packed_weight_g, undefined)
  assert.equal(
    (await onRequestPatch(ctx(db, { ...input, weight_public: 0 }))).status,
    200,
  )
  assert.equal(
    flattenProductRows(sql.prepare(PRODUCTS_QUERY).all())[0].productWeightMaxG,
    null,
  )
  assert.equal(
    (await onRequestPatch(ctx(db, { ...input, packed_weight_g: 2500 }))).status,
    400,
  )
  assert.equal(row().packed_weight_g, 3500)
})
test('new options persist weight with their newly assigned identity', async () => {
  const { db, sql } = fixture()
  const r = await onRequestPost(ctx(db, input, 'p'))
  assert.equal(r.status, 201)
  const { id } = await r.json()
  assert.equal(
    sql
      .prepare('SELECT packed_weight_g FROM sku_weights WHERE sku_id=?')
      .get(id).packed_weight_g,
    3500,
  )
})
test('bulk updates reject the entire batch when one weight is invalid', async () => {
  const { db, sql } = fixture()
  const r = await bulk(
    ctx(db, {
      lines: [
        { ...input, skuId: 1 },
        { skuId: 2, packed_weight_g: -1 },
      ],
    }),
  )
  assert.equal(r.status, 400)
  assert.equal(sql.prepare('SELECT count(*) n FROM sku_weights').get().n, 0)
})
test('saved postage costs and original estimate survive catalogue and rate changes', async () => {
  const { db, sql } = fixture()
  sql.exec(
    "INSERT INTO orders(id,status,ship_country) VALUES('o','paid','GB'); INSERT INTO order_items VALUES('o',1,2,1000); INSERT INTO order_item_weights VALUES('o',1,2000,3000,3500,'Standard',1);",
  )
  assert.equal(
    (
      await savePostage(
        ctx(
          db,
          { actual_weight_g: 7000, actual_cost_pence: 900, service: 'Tracked' },
          'o',
        ),
      )
    ).status,
    200,
  )
  const original = sql
    .prepare("SELECT estimate_json FROM order_postage WHERE order_id='o'")
    .get().estimate_json
  await onRequestPatch(ctx(db, { ...input, packed_weight_g: 5000 }))
  const r = await (await readPostage(ctx(db, {}, 'o'))).json()
  assert.equal(r.lines[0].packed_weight_g, 3500)
  assert.equal(r.saved.actual_cost_pence, 900)
  await savePostage(
    ctx(
      db,
      { actual_weight_g: 7100, actual_cost_pence: 1000, service: 'Other' },
      'o',
    ),
  )
  assert.equal(
    sql
      .prepare("SELECT estimate_json FROM order_postage WHERE order_id='o'")
      .get().estimate_json,
    original,
  )
})

test('actual parcel weight does not replace the calculated item-weight total', async () => {
  const {db,sql}=fixture()
  sql.exec("INSERT INTO orders(id,status,ship_country) VALUES('o','paid','GB'); INSERT INTO order_items VALUES('o',1,2,1000); INSERT INTO order_item_weights VALUES('o',1,2000,3000,3500,'Standard',1);")
  await savePostage(ctx(db,{actual_weight_g:7100,actual_cost_pence:875,service:'Tracked'},'o'))
  const result=await (await readPostage(ctx(db,{},'o'))).json()
  assert.equal(result.calculated_weight_g,7000)
  assert.equal(result.quote.total_weight_g,7100)
})
