import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const endpoint = async () => (await import('../functions/api/admin/products/save.js')).onRequestPost
function fixture() {
  const sql = new DatabaseSync(':memory:')
  sql.exec(fs.readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8'))
  sql.exec(fs.readFileSync(new URL('../d1/staging/image-storage.sql', import.meta.url), 'utf8'))
  sql.exec(fs.readFileSync(new URL('../d1/migrations/015-admin-save-requests.sql', import.meta.url), 'utf8'))
  const wrap = (q, args = []) => ({ bind: (...a) => wrap(q, a), first: async () => sql.prepare(q).get(...args), all: async () => ({ results: sql.prepare(q).all(...args) }), run: async () => { const r = sql.prepare(q).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } } } })
  const db = { prepare: q => wrap(q), batch: async ss => { sql.exec('BEGIN'); try { const results = []; for (const s of ss) results.push(await s.run()); sql.exec('COMMIT'); return results } catch (e) { sql.exec('ROLLBACK'); throw e } } }
  return { sql, db }
}
const sku = (code='SAVE-1') => ({ sku:code, price:'12.50', track_mode:'binary', in_stock:true, packed_weight_g:1200, originalInventory:{track_mode:'binary',quantity:null,in_stock:1} })
const body = () => ({ requestId:crypto.randomUUID(), product:{name:'Save fixture',slug:'save-fixture'}, skus:[sku()] })
const save = async (db, value) => (await endpoint())({ env:{DB:db}, data:{actorEmail:'qa@example.invalid'}, request:new Request('http://localhost/api/admin/products/save',{method:'POST',body:JSON.stringify(value)}) })

test('lost create response replay preserves product and option identities', async () => {
 const {sql,db}=fixture(); const payload=body()
 const first=await save(db,payload); assert.equal(first.status,201); const original=await first.json()
 const replay=await save(db,payload); assert.equal(replay.status,200); assert.deepEqual(await replay.json(),original)
 assert.equal(sql.prepare('SELECT count(*) n FROM products').get().n,1)
 assert.equal(sql.prepare('SELECT count(*) n FROM skus').get().n,1)
 payload.product.name='Changed under same key'; assert.equal((await save(db,payload)).status,409)
})

test('option reconciliation and product details roll back together on database failure', async () => {
 const {sql,db}=fixture(); const created=await (await save(db,body())).json()
 const id=sql.prepare('SELECT id FROM skus').get().id
 sql.exec("CREATE TRIGGER reject_bad BEFORE INSERT ON skus WHEN NEW.sku='FAIL' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;")
 const payload={...body(),id:created.id,product:{name:'Changed'},skus:[{...sku(),id},sku('GOOD'),sku('FAIL')]}
 assert.equal((await save(db,payload)).status,500)
 assert.equal(sql.prepare('SELECT name FROM products').get().name,'Save fixture')
 assert.equal(sql.prepare('SELECT count(*) n FROM skus').get().n,1)
 sql.exec('DROP TRIGGER reject_bad')
 assert.equal((await save(db,payload)).status,200)
 assert.equal((await save(db,payload)).status,200)
 assert.equal(sql.prepare('SELECT count(*) n FROM skus').get().n,3)
})

test('foreign options and removing historically ordered options cannot mutate a product', async () => {
 const {sql,db}=fixture(); const p=await (await save(db,body())).json(); const q=await (await save(db,body())).json()
 const own=sql.prepare('SELECT id FROM skus WHERE product_id=?').get(p.id).id
 const foreign=sql.prepare('SELECT id FROM skus WHERE product_id=?').get(q.id).id
 assert.equal((await save(db,{...body(),id:p.id,skus:[{...sku(),id:foreign}]})).status,400)
 sql.prepare("INSERT INTO orders(id) VALUES('fixture-order')").run()
 sql.prepare("INSERT INTO order_items(order_id,sku_id,quantity,unit_price_pence) VALUES('fixture-order',?,1,1250)").run(own)
 assert.equal((await save(db,{...body(),id:p.id,skus:[sku('REPLACEMENT')]})).status,409)
 assert.equal(sql.prepare('SELECT count(*) n FROM skus WHERE product_id=?').get(p.id).n,1)
})

test('lost image upload response replay creates one gallery row and one object',async()=>{
 const {sql,db}=fixture();const {id}=await(await save(db,body())).json()
 const {onRequestPost:upload}=await import('../functions/api/admin/products/[id]/images.js')
 const objects=new Map(),key=crypto.randomUUID()
 const send=()=>{const form=new FormData();form.set('image',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'image.png',{type:'image/png'}));return upload({params:{id},env:{DB:db,IMAGES:{put:async(k,v)=>objects.set(k,v)}},data:{actorEmail:'qa@example.invalid'},request:new Request('http://localhost/api',{method:'POST',headers:{'Idempotency-Key':key},body:form})})}
 const first=await send();assert.equal(first.status,201);const value=await first.json()
 const retry=await send();assert.equal(retry.status,200);assert.deepEqual(await retry.json(),value)
 assert.equal(sql.prepare('SELECT count(*) n FROM product_images').get().n,1)
 assert.equal(objects.size,1)
})

test('sandbox image upload, retry, serving, replacement and deletion use only its test database',async()=>{
 const {sql,db}=fixture();const {id}=await(await save(db,body())).json()
 const env={DB:db,STAGING_IMAGE_STORAGE:'d1',STRIPE_TEST_ONLY:'1',MAIL_DRY_RUN:'true'}
 const {onRequestPost:upload}=await import('../functions/api/admin/products/[id]/images.js')
 const {onRequestPost:replace}=await import('../functions/api/admin/products/[id]/images/[imageId]/replace.js')
 const {onRequestDelete:remove}=await import('../functions/api/admin/products/[id]/images/[imageId].js')
 const {onRequestGet:getImage,onRequestHead:headImage}=await import('../functions/api/images/[[path]].js')
 const bytes=new Uint8Array(600000).fill(21);bytes.set([137,80,78,71,13,10,26,10])
 const form=content=>{const data=new FormData();data.set('image',new File([content],'image.png',{type:'image/png'}));return data}
 const requestKey=crypto.randomUUID()
 const send=()=>upload({params:{id},env,data:{actorEmail:'qa@example.invalid'},request:new Request('http://localhost/api',{method:'POST',headers:{'Idempotency-Key':requestKey},body:form(bytes)})})
 const first=await send();assert.equal(first.status,201);const image=await first.json()
 assert.deepEqual(await (await send()).json(),image)
 assert.equal(sql.prepare('SELECT count(*) n FROM product_images').get().n,1)
 assert.equal(sql.prepare('SELECT count(*) n FROM staging_image_chunks').get().n,2)
 const path=image.path.slice('/api/images/'.length).split('/')
 const context=method=>({params:{path},env,request:new Request('http://localhost'+image.path,{method})})
 const head=await headImage(context('HEAD'));assert.equal(head.status,200)
 assert.equal(head.headers.get('content-length'),String(bytes.length))
 const served=await getImage(context('GET'));assert.equal(served.status,200)
 assert.deepEqual(new Uint8Array(await served.arrayBuffer()),bytes)
 assert.equal(head.headers.get('etag'),served.headers.get('etag'))
 const next=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3])
 const swapped=await replace({params:{id,imageId:String(image.id)},env,data:{actorEmail:'qa@example.invalid'},request:new Request('http://localhost/api',{method:'POST',body:form(next)})})
 assert.equal(swapped.status,200)
 assert.equal((await getImage(context('GET'))).status,404)
 const replacement=await swapped.json()
 const nextContext={params:{path:replacement.path.slice('/api/images/'.length).split('/')},env,request:new Request('http://localhost'+replacement.path)}
 assert.deepEqual(new Uint8Array(await (await getImage(nextContext)).arrayBuffer()),next)
 assert.equal((await remove({params:{id,imageId:String(image.id)},env,data:{actorEmail:'qa@example.invalid'}})).status,200)
 assert.equal((await getImage(nextContext)).status,404)
 assert.equal(sql.prepare('SELECT count(*) n FROM staging_image_objects').get().n,0)
 assert.equal(sql.prepare('SELECT count(*) n FROM staging_image_chunks').get().n,0)
 const {putImageObject,deleteImageObject}=await import('../functions/lib/image-upload.mjs')
 const pending={buffer:bytes.buffer,type:'image/png',ext:'png'}
 const orphan=await putImageObject(env,id,pending,'retry-after-gallery-failure')
 await putImageObject(env,id,pending,'retry-after-gallery-failure')
 assert.equal(sql.prepare('SELECT count(*) n FROM staging_image_objects').get().n,1)
 assert.equal(sql.prepare('SELECT count(*) n FROM staging_image_chunks').get().n,2)
 await deleteImageObject(env,orphan.key)
})

test('sandbox image storage fails closed outside the protected test mode',async()=>{
 const {db}=fixture()
 const {onRequestPost:upload}=await import('../functions/api/admin/products/[id]/images.js')
 const result=await upload({params:{id:'missing'},env:{DB:db,STAGING_IMAGE_STORAGE:'d1',STRIPE_TEST_ONLY:'0',MAIL_DRY_RUN:'true'},request:new Request('http://localhost/api',{method:'POST'}),data:{actorEmail:'qa@example.invalid'}})
 assert.equal(result.status,503)
})

test('gallery deletion and replacement roll back with a failed cover update',async()=>{
 const {sql,db}=fixture();const {id}=await(await save(db,body())).json()
 sql.prepare("INSERT INTO product_images(product_id,key,path) VALUES(?,'old-object','/api/images/old-object')").run(id)
 const imageId=sql.prepare('SELECT id FROM product_images').get().id
 sql.prepare("UPDATE products SET image='/api/images/old-object' WHERE id=?").run(id)
 sql.exec("CREATE TRIGGER reject_cover BEFORE UPDATE ON products BEGIN SELECT RAISE(ABORT,'cover fixture failure'); END;")
 const objects=new Map([['old-object',true]])
 const env={DB:db,IMAGES:{put:async(k,v)=>objects.set(k,v),delete:async k=>objects.delete(k)}}
 const base={params:{id,imageId:String(imageId)},env,data:{actorEmail:'qa@example.invalid'}}
 const {onRequestDelete:remove}=await import('../functions/api/admin/products/[id]/images/[imageId].js')
 assert.equal((await remove(base)).status,500)
 assert.equal(sql.prepare('SELECT count(*) n FROM product_images').get().n,1)
 assert.equal(objects.has('old-object'),true)
 const {onRequestPost:replace}=await import('../functions/api/admin/products/[id]/images/[imageId]/replace.js')
 const form=new FormData();form.set('image',new File([new Uint8Array([137,80,78,71,13,10,26,10])],'image.png',{type:'image/png'}))
 assert.equal((await replace({...base,request:new Request('http://localhost/api',{method:'POST',body:form})})).status,500)
 assert.equal(sql.prepare('SELECT path FROM product_images').get().path,'/api/images/old-object')
 assert.equal(objects.size,1)
})

test('saving other product fields preserves sales, and deliberately stale stock changes are rejected atomically',async()=>{
 const {sql,db}=fixture();const {id}=await(await save(db,{...body(),skus:[{...sku(),track_mode:'quantity',quantity:10}]})).json()
 const option=sql.prepare('SELECT * FROM skus WHERE product_id=?').get(id)
 const originalInventory={track_mode:option.track_mode,quantity:option.quantity,in_stock:option.in_stock}
 sql.prepare('UPDATE skus SET quantity=9 WHERE id=?').run(option.id)
 const payload={...body(),id,product:{name:'Copy edited'},skus:[{...sku(),id:option.id,track_mode:'quantity',quantity:10,originalInventory}]}
 assert.equal((await save(db,payload)).status,200)
 assert.equal(sql.prepare('SELECT quantity FROM skus WHERE id=?').get(option.id).quantity,9)
 const stale={...payload,requestId:crypto.randomUUID(),product:{name:'Must roll back'},skus:[{...payload.skus[0],quantity:15}]}
 assert.equal((await save(db,stale)).status,409)
 assert.equal(sql.prepare('SELECT name FROM products WHERE id=?').get(id).name,'Copy edited')
 assert.equal(sql.prepare('SELECT quantity FROM skus WHERE id=?').get(option.id).quantity,9)
})

test('an intervening sale inside the save boundary rejects edited inventory and rolls back details',async()=>{
 const {sql,db}=fixture();const {id}=await(await save(db,{...body(),skus:[{...sku(),track_mode:'quantity',quantity:10}]})).json()
 const option=sql.prepare('SELECT * FROM skus WHERE product_id=?').get(id)
 const batch=db.batch;db.batch=async statements=>{sql.prepare('UPDATE skus SET quantity=9 WHERE id=?').run(option.id);return batch(statements)}
 const result=await save(db,{...body(),id,product:{name:'Should not commit'},skus:[{...sku(),id:option.id,track_mode:'quantity',quantity:15,originalInventory:{track_mode:'quantity',quantity:10,in_stock:1}}]})
 assert.equal(result.status,409)
 assert.equal(sql.prepare('SELECT name FROM products WHERE id=?').get(id).name,'Save fixture')
 assert.equal(sql.prepare('SELECT quantity FROM skus WHERE id=?').get(option.id).quantity,9)
})
