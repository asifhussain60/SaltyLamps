import test from 'node:test'
import assert from 'node:assert/strict'
import { commerceFixture, fixtureRequest } from './helpers/commerce-fixture.mjs'
import { onRequestPost } from '../functions/api/admin/products.js'

const payload = () => ({sourceId:`product_${crypto.randomUUID()}`,product:{name:'Imported lamp',slug:'imported-lamp'},skus:[{sku:'IMPORT-1',price:'12.50',track_mode:'binary',in_stock:true,packed_weight_g:1000}]})
const create=(db,body)=>onRequestPost({env:{DB:db},data:{actorEmail:'review@example.invalid'},request:fixtureRequest('/api/admin/products',body)})

test('import retries preserve source product identity, options and subsequent owner edits',async()=>{
 const {db,sql}=commerceFixture(), body=payload()
 const first=await create(db,body); assert.equal(first.status,201); assert.equal((await first.json()).id,body.sourceId)
 sql.prepare('UPDATE products SET name=? WHERE id=?').run('Owner correction',body.sourceId)
 const replay=await create(db,body); assert.equal(replay.status,200); assert.equal((await replay.json()).id,body.sourceId)
 assert.equal(sql.prepare('SELECT count(*) n FROM products WHERE id=?').get(body.sourceId).n,1)
 assert.equal(sql.prepare('SELECT count(*) n FROM skus WHERE product_id=?').get(body.sourceId).n,1)
 assert.equal(sql.prepare('SELECT name FROM products WHERE id=?').get(body.sourceId).name,'Owner correction')
})

test('ordinary creation remains independent and malformed import identities are rejected',async()=>{
 const {db}=commerceFixture(), body=payload()
 assert.equal((await create(db,{...body,sourceId:'../bad'})).status,400)
 delete body.sourceId
 const a=await(await create(db,body)).json(), b=await(await create(db,body)).json()
 assert.notEqual(a.id,b.id)
})
