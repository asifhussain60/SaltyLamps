import assert from 'node:assert/strict'
import test from 'node:test'
import { CATEGORIES_QUERY, CATEGORY_ALIASES_QUERY, CONTENT_QUERIES } from '../functions/lib/content-queries.mjs'
import { PRODUCTS_QUERY, PRODUCT_IMAGES_QUERY } from '../functions/lib/flatten-products.mjs'
import { assertReadOnlySql, resultSetsFromWrangler } from '../scripts/read-only-sql.mjs'

const clean = q => q.trim().replace(/;\s*$/, '')

test('every query the snapshot refresh sends to the test shop database is a plain read', () => {
  const statements = [PRODUCTS_QUERY, PRODUCT_IMAGES_QUERY, CATEGORIES_QUERY, CATEGORY_ALIASES_QUERY, ...CONTENT_QUERIES].map(clean)
  assert.doesNotThrow(() => assertReadOnlySql(statements))
})

test('anything that could change the database is refused before wrangler starts', () => {
  for (const sql of [
    "UPDATE products SET price = 1",
    "DELETE FROM skus",
    "INSERT INTO settings VALUES (1)",
    "DROP TABLE products",
    "SELECT 1; DELETE FROM skus",
    "SELECT * FROM products WHERE id IN (SELECT 1) ; UPDATE products SET name = 'x'",
    "PRAGMA writable_schema = 1",
    "WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x",
  ]) {
    assert.throws(() => assertReadOnlySql([sql]), /Refusing/, sql)
  }
})

test('a column called updated_at is not mistaken for an UPDATE statement', () => {
  assert.doesNotThrow(() => assertReadOnlySql(['SELECT updated_at, created_at FROM products']))
})

test('a half-read or malformed wrangler answer is refused rather than built into a site', () => {
  const ok = [{ success: true, results: [{ a: 1 }] }, { success: true, results: [] }]
  assert.deepEqual(resultSetsFromWrangler(ok, 2), [[{ a: 1 }], []])
  assert.throws(() => resultSetsFromWrangler(ok, 3), /expected 3/)
  assert.throws(() => resultSetsFromWrangler({ error: 'nope' }, 1), /list of result sets/)
  assert.throws(() => resultSetsFromWrangler([{ success: false, results: [] }], 1), /failed/)
})
