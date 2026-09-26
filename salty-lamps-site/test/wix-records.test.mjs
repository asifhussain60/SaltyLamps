import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fields from '../functions/lib/wix-fields.json' with { type: 'json' }
import {commerceFixture} from './helpers/commerce-fixture.mjs'
import {onRequestGet,onRequestPut} from '../functions/api/admin/wix-records.js'
function fixture(){
 const shop=commerceFixture(),archive=commerceFixture()
 archive.sql.exec(fs.readFileSync(new URL('../d1/staging/wix-business-records.sql',import.meta.url),'utf8'))
 archive.sql.prepare('INSERT INTO wix_import_batches(id,source_hashes,status) VALUES(?,?,?)').run('snapshot','{}','reconciled')
 const columns=fields.orders.fields.map(x=>x.column), marks=columns.map(()=>'?').join(',')
 const values=columns.map(c=>({order_number:'0007',order_id:'wix-order-seven',contact_email:'fixture@example.invalid',note_from_customer:'=Original\nsecond line',total:'1,234.50',currency:'GBP'}[c]||''))
 archive.sql.prepare(`INSERT INTO wix_orders(batch_id,source_row,${columns.map(c=>'"'+c+'"').join(',')}) VALUES('snapshot',1,${marks})`).run(...values)
 return {shop,archive,env:{DB:shop.db,WIX_ARCHIVE_DB:archive.db},close(){shop.sql.close();archive.sql.close()}}
}
test('all original fields remain searchable including notes, blanks, leading zeros and money',async()=>{
 const f=fixture();try{
  const response=await onRequestGet({request:new Request('https://admin.saltylamps.co.uk/api/admin/wix-records?q=second'),env:f.env})
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.total,1)
  assert.equal(body.rows[0].order_number,'0007');assert.equal(body.rows[0].total,'1,234.50');assert.equal(body.rows[0].note_from_customer,'=Original\nsecond line');assert.equal(body.fields.length,49)
  const invalid=await onRequestGet({request:new Request('https://admin.saltylamps.co.uk/api/admin/wix-records?dataset=__proto__'),env:f.env});assert.equal(invalid.status,400)
  const missing=await onRequestGet({request:new Request('https://admin.saltylamps.co.uk/api/admin/wix-records'),env:{DB:f.shop.db}});assert.equal(missing.status,503)
 }finally{f.close()}
})
test('review writes preserve original history and create no live orders or email jobs',async()=>{
 const f=fixture();try{
  const before=f.archive.sql.prepare('SELECT * FROM wix_orders').get(),live=f.shop.sql.prepare('SELECT count(*) n FROM orders').get()
  const request=new Request('https://admin.saltylamps.co.uk/api/admin/wix-records',{method:'PUT',headers:{origin:'https://admin.saltylamps.co.uk','content-type':'application/json'},body:JSON.stringify({dataset:'orders',batch:'snapshot',row:1,state:'follow_up',notes:'Check original delivery evidence'})})
  const result=await onRequestPut({request,env:f.env,data:{actorEmail:'reviewer@example.invalid'}});assert.equal(result.status,200)
  assert.deepEqual(f.archive.sql.prepare('SELECT * FROM wix_orders').get(),before);assert.deepEqual(f.shop.sql.prepare('SELECT count(*) n FROM orders').get(),live)
  assert.equal(f.shop.sql.prepare("SELECT count(*) n FROM sqlite_master WHERE name LIKE 'wix_%'").get().n,0)
  assert.equal(f.archive.sql.prepare('SELECT review_state FROM wix_record_work').get().review_state,'follow_up')
  assert.equal(f.archive.sql.prepare('SELECT count(*) n FROM wix_review_audit').get().n,1)
 }finally{f.close()}
})
test('review writes reject cross-origin requests and nonexistent records',async()=>{
 const f=fixture();try{
  for(const [origin,row,status] of [['https://attacker.invalid',1,403],['https://admin.saltylamps.co.uk',2,404]]){
   const request=new Request('https://admin.saltylamps.co.uk/api/admin/wix-records',{method:'PUT',headers:{origin},body:JSON.stringify({dataset:'orders',batch:'snapshot',row,state:'reviewed',notes:''})})
   assert.equal((await onRequestPut({request,env:f.env,data:{actorEmail:'reviewer@example.invalid'}})).status,status)
  }
 }finally{f.close()}
})
