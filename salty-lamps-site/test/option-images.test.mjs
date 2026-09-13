import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { PRODUCTS_QUERY, PRODUCT_IMAGES_QUERY, flattenProductRows } from '../functions/lib/flatten-products.mjs'
import { parseImageId, checkOptionImage } from '../functions/lib/option-images.mjs'
import { onRequestPatch } from '../functions/api/admin/skus/[id].js'
import { onRequestPost } from '../functions/api/admin/products/[id]/skus.js'

function fixture() {
  const sql = new DatabaseSync(':memory:')
  sql.exec(fs.readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8'))
  const migration = fs.readFileSync(new URL('../d1/migrations/009-option-images.sql', import.meta.url), 'utf8')
  sql.exec(migration); sql.exec(migration)
  sql.exec(`INSERT INTO products (id,name,slug,image) VALUES ('a','Platter','platter','/square.jpg'), ('b','Lamp','lamp','/lamp.jpg');
    INSERT INTO skus (id,sku,product_id,variant_label,price_pence,track_mode,in_stock) VALUES
    (1,'duplicate','a','Square',1999,'binary',1),(2,'duplicate','a','Round',1999,'binary',1),(3,'lamp','b','',2999,'binary',1);
    INSERT INTO product_images (id,product_id,path,sort_order) VALUES
    (10,'a','/square.jpg',0),(11,'a','/round.jpg',1),(12,'a','/detail.jpg',2),(20,'b','/lamp.jpg',0);
    INSERT INTO sku_images VALUES (1,10),(2,11);`)
  const wrap = (query, args = []) => ({
    bind: (...values) => wrap(query, values),
    first: async () => sql.prepare(query).get(...args),
    all: async () => ({ results: sql.prepare(query).all(...args) }),
    run: async () => { const r = sql.prepare(query).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } } },
  })
  const db = { prepare: query => wrap(query), batch: async statements => {
    sql.exec('BEGIN')
    try { const result = []; for (const s of statements) result.push(await s.run()); sql.exec('COMMIT'); return result }
    catch (e) { sql.exec('ROLLBACK'); throw e }
  } }
  const rows = () => flattenProductRows(sql.prepare(PRODUCTS_QUERY).all(), sql.prepare(PRODUCT_IMAGES_QUERY).all())
  return { sql, db, rows }
}

test('equal-price options resolve distinct photos without multiplying catalogue rows', () => {
  const { rows } = fixture(); const products = rows()
  assert.equal(products.length, 3)
  assert.equal(products[0].image, '/lamp.jpg')
  const square = products.find(p => p.skuId === 1), round = products.find(p => p.skuId === 2)
  assert.equal(square.price, round.price)
  assert.deepEqual(round.images, ['/round.jpg', '/detail.jpg'])
  assert.deepEqual(square.images, ['/square.jpg', '/detail.jpg'])
  assert.equal(round.hasOptionImage, true)
})

test('replacement follows the gallery identity; deletion clears assignments and uses cover fallback', () => {
  const { sql, rows } = fixture()
  sql.exec("UPDATE product_images SET path='/new-round.jpg' WHERE id=11")
  assert.equal(rows().find(p => p.skuId === 2).image, '/new-round.jpg')
  sql.exec('DELETE FROM product_images WHERE id=11')
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM sku_images WHERE sku_id=2').get().n, 0)
  assert.equal(rows().find(p => p.skuId === 2).image, '/square.jpg')
})

test('database rejects cross-product or missing image assignments, including updates', () => {
  const { sql } = fixture()
  assert.throws(() => sql.exec('INSERT INTO sku_images VALUES (3,10)'), /same product/)
  assert.throws(() => sql.exec('UPDATE sku_images SET image_id=20 WHERE sku_id=1'), /same product/)
  assert.throws(() => sql.exec('UPDATE sku_images SET image_id=999 WHERE sku_id=1'), /same product/)
  sql.exec('DELETE FROM skus WHERE id=2')
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM sku_images WHERE sku_id=2').get().n, 0)
})

test('image inputs reject booleans, fractions, objects and unsafe identifiers', async () => {
  for (const value of [true, false, {}, [], 0, -1, 1.5, '1e2', 'abc', Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.ok(Number.isNaN(parseImageId(value)))
  assert.equal(parseImageId(undefined), undefined)
  assert.equal(parseImageId(''), null)
  assert.equal(parseImageId('11'), 11)
  const { db } = fixture()
  assert.equal((await checkOptionImage(db, 'a', 20)).status, 400)
})

const body = extra => ({ sku: 'duplicate', variant_label: 'Round', price: '19.99', track_mode: 'binary', in_stock: true, ...extra })
const context = (db, input, id='2') => ({ env: { DB: db }, params: { id }, data: { actorEmail: 'test@example.invalid' }, request: new Request('http://localhost/api', { method: 'PATCH', body: JSON.stringify(input) }) })

test('older catalogue clients preserve assignments; explicit clear and assignment are atomic', async () => {
  const { db, rows } = fixture()
  assert.equal((await onRequestPatch(context(db, body({})))).status, 200)
  assert.equal(rows().find(p => p.skuId === 2).image, '/round.jpg')
  assert.equal((await onRequestPatch(context(db, body({image_id:20,price:'1'})))).status, 400)
  assert.equal(rows().find(p => p.skuId === 2).price, 19.99)
  assert.equal((await onRequestPatch(context(db, body({image_id:''})))).status, 200)
  assert.equal(rows().find(p => p.skuId === 2).hasOptionImage, false)
  assert.equal((await onRequestPatch(context(db, body({image_id:11})))).status, 200)
  assert.equal(rows().find(p => p.skuId === 2).image, '/round.jpg')
})

test('creating an option assigns its photo to the newly created identity', async () => {
  const { db, rows } = fixture()
  const response = await onRequestPost(context(db, body({variant_label:'New round',image_id:11}), 'a'))
  assert.equal(response.status, 201)
  const { id } = await response.json()
  assert.equal(rows().find(p => p.skuId === id).image, '/round.jpg')
})
