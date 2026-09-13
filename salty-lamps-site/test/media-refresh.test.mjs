import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { PRODUCTS_QUERY, PRODUCT_IMAGES_QUERY, flattenProductRows } from '../functions/lib/flatten-products.mjs'
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const assignments = JSON.parse(read('data/media-refresh-assignments.json'))
const assets = new Map(JSON.parse(read('data/media-refresh.json')).assets.map(a => [a.id, a.output]))
const migration = read('d1/migrations/010-lighter-catalogue.sql')
function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(read('d1/schema.sql'))
  db.exec(read('d1/migrations/004-content-layer.sql'))
  let id = 1000
  for (const p of assignments.products) {
    db.prepare('INSERT INTO products(id,name,slug,image) VALUES(?,?,?,?)').run(p.productId,p.productId,p.productId,'/original.jpg')
    for (const o of p.options) db.prepare('INSERT INTO skus(id,sku,product_id,variant_label,price_pence,track_mode,in_stock) VALUES(?,?,?,?,?,?,?)').run(++id,o.sku,p.productId,o.label,1234,'binary',id%2)
  }
  return db
}
function apply(db) {
  db.exec('BEGIN')
  try { db.exec(migration); db.exec('COMMIT') } catch(e) { db.exec('ROLLBACK'); throw e }
}
test('complete refresh preserves commercial data and maps all 73 options regardless of numeric IDs', () => {
  const db=fixture(), before=db.prepare('SELECT * FROM skus ORDER BY id').all()
  apply(db)
  assert.deepEqual(db.prepare('SELECT * FROM skus ORDER BY id').all(), before)
  const rows=flattenProductRows(db.prepare(PRODUCTS_QUERY).all(),db.prepare(PRODUCT_IMAGES_QUERY).all())
  assert.equal(rows.length,73)
  for(const p of assignments.products) for(const o of p.options) {
    const sku=before.find(s=>s.product_id===p.productId && s.sku===o.sku && s.variant_label===o.label)
    const row=rows.find(r=>r.skuId===sku.id)
    assert.equal(row.image,assets.get(o.asset))
    assert.deepEqual(row.images,[assets.get(o.asset)])
  }
  db.exec("UPDATE products SET image='/owner-edit.jpg'; DELETE FROM sku_images WHERE sku_id=1001")
  const images=db.prepare('SELECT * FROM product_images ORDER BY id').all()
  apply(db)
  assert.equal(db.prepare('SELECT count(*) n FROM sku_images').get().n,72)
  assert.equal(db.prepare("SELECT count(*) n FROM products WHERE image='/owner-edit.jpg'").get().n,33)
  assert.deepEqual(db.prepare('SELECT * FROM product_images ORDER BY id').all(),images)
})
test('refresh rejects a missing or renamed option before modifying the catalogue', () => {
  const db=fixture()
  db.exec("UPDATE skus SET variant_label='renamed' WHERE id=1001")
  assert.throws(()=>apply(db),/CHECK constraint/)
  assert.equal(db.prepare('SELECT count(*) n FROM sku_images').get().n,0)
  assert.equal(db.prepare("SELECT count(*) n FROM products WHERE image='/original.jpg'").get().n,33)
})
