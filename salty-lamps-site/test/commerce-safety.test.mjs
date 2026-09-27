import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import Stripe from 'stripe'
import { commerceFixture,fixtureAddress,fixtureRequest } from './helpers/commerce-fixture.mjs'
import { onRequestPost as checkout } from '../functions/api/checkout.js'
import { onRequestGet as verify } from '../functions/api/checkout/verify.js'
import { onRequestPatch as patchOrder } from '../functions/api/admin/orders/[id].js'
import { onRequestPost as webhook } from '../functions/api/webhook.js'

const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
const envFor=db=>({DB:db,STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_PUBLISHABLE_KEY:'pk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture'})
const buy=env=>checkout({env,request:fixtureRequest('/api/checkout',{address:fixtureAddress,postcode:fixtureAddress.postcode,items:[{skuId:1,quantity:1}]})})
const signedRequest=event=>{const payload=JSON.stringify(event);return new Request('http://localhost/api/webhook',{method:'POST',body:payload,headers:{'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_fixture'})}})}

// Real SQLite transactions and triggers; only the external provider is replaced.
test('two buyers cannot both receive payable checkouts for the last tracked unit',async()=>{
 const {sql,db}=commerceFixture();let sessions=0;const prior=globalThis.fetch
 globalThis.fetch=async(url,init)=>String(url).endsWith('/v1/customers')?json({id:'cus_fixture'}):String(url).endsWith('/expire')?json({status:'expired'}):json({id:`cs_test_reserve_${++sessions}`,client_secret:'fixture',expires_at:Math.floor(Date.now()/1000)+1800})
 try {const results=await Promise.all([buy(envFor(db)),buy(envFor(db))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(sql.prepare('SELECT quantity FROM skus WHERE id=1').get().quantity,1)}finally{globalThis.fetch=prior;sql.close()}
})

test('shipping charged for the submitted address cannot be changed inside the payment form',async()=>{
 const {sql,db}=commerceFixture();const prior=globalThis.fetch;let sent
 globalThis.fetch=async(url,init)=>{if(String(url).endsWith('/v1/customers'))return json({id:'cus_fixture'});sent=new URLSearchParams(init.body);return json({id:'cs_test_address',client_secret:'fixture',expires_at:Math.floor(Date.now()/1000)+1800})}
 try {assert.equal((await buy(envFor(db))).status,200);assert.equal(sent.get('shipping_address_collection[allowed_countries][0]'),null);assert.equal(sent.get('payment_intent_data[shipping][address][postal_code]'),'ST4 3NP');const row=sql.prepare("SELECT address_json FROM checkout_reservations WHERE session_id='cs_test_address'").get();assert.equal(JSON.parse(row.address_json).line1,fixtureAddress.line1)}finally{globalThis.fetch=prior;sql.close()}
})

test('receipts include every paid item across provider pages',async()=>{
 const {sql,db}=commerceFixture();const prior=globalThis.fetch
 const line=n=>({id:`li_${n}`,quantity:1,amount_total:1000,price:{unit_amount:1000,product:{metadata:{sku_id:String(n)}}}})
 globalThis.fetch=async url=>{const u=new URL(String(url));if(u.pathname.endsWith('/line_items'))return json(u.searchParams.has('starting_after')?{data:[line(3)],has_more:false}:{data:[line(1),line(2)],has_more:true});return json({id:'cs_test_pagination',status:'complete',payment_status:'paid',metadata:{store:'salty-lamps'},line_items:{data:[line(1)],has_more:true}})}
 try {const response=await verify({env:envFor(db),request:new Request('http://localhost/api/checkout/verify?session_id=cs_test_pagination')});assert.equal(response.status,200);assert.equal((await response.json()).items.length,3)}finally{globalThis.fetch=prior;sql.close()}
})

test('cancelling an order never promises an unperformed refund and preserves custom wording',()=>{
 const {sql}=commerceFixture();try{assert.doesNotMatch(sql.prepare("SELECT intro FROM email_templates WHERE key='order_cancelled'").get().intro,/released back|refunded/i);sql.prepare("UPDATE email_templates SET intro='Owner wording' WHERE key='order_cancelled'").run();sql.exec(fs.readFileSync(new URL('../d1/migrations/014-commerce-safety.sql',import.meta.url),'utf8'));assert.equal(sql.prepare("SELECT intro FROM email_templates WHERE key='order_cancelled'").get().intro,'Owner wording')}finally{sql.close()}
})

test('a pending Stripe refund is not reported as completed',async()=>{
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,payment_intent,status,amount_total_pence) VALUES('cs_test_refund','pi_fixture','paid',1500)")
 const prior=globalThis.fetch;globalThis.fetch=async url=>json(new URL(String(url)).pathname.endsWith('/refunds') && String(url).includes('?')?{data:[],has_more:false}:{id:'re_fixture',status:'pending',amount:1500,payment_intent:'pi_fixture'})
 try{const response=await patchOrder({params:{id:'cs_test_refund'},request:fixtureRequest('/api/admin/orders/cs_test_refund',{status:'refunded'},'PATCH'),env:envFor(db),data:{actorEmail:'fixture@example.invalid'}});assert.equal(response.status,200);const body=await response.json();assert.equal(body.order.status,'paid');assert.equal(body.order.refund_status,'pending')}finally{globalThis.fetch=prior;sql.close()}
})

test('webhook retry recovers notifications after the paid order committed but email preparation failed',async()=>{
 const {sql,db}=commerceFixture();const prior=globalThis.fetch
 let failTemplates=true
 const wrapped={...db,prepare:q=>{if(failTemplates && q.includes('FROM email_templates'))throw Error('injected template outage');return db.prepare(q)}}
 const session={id:'cs_test_recovery',payment_intent:'pi_fixture',status:'complete',payment_status:'paid',metadata:{store:'salty-lamps'},customer_details:{email:fixtureAddress.email},amount_total:1500,currency:'gbp'}
 const event={id:'evt_fixture',type:'checkout.session.completed',data:{object:session}}
 globalThis.fetch=async url=>String(url).includes('/line_items')?json({data:[{quantity:1,price:{unit_amount:1000,product:{metadata:{sku_id:'1'}}}}],has_more:false}):json({latest_charge:{payment_method_details:{type:'card'}}})
 try{await webhook({env:envFor(wrapped),request:signedRequest(event)});assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n,1);failTemplates=false;assert.equal((await webhook({env:envFor(wrapped),request:signedRequest(event)})).status,200);assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_outbox WHERE order_id='cs_test_recovery'").get().n,2);assert.equal(sql.prepare('SELECT quantity FROM skus WHERE id=1').get().quantity,0);await webhook({env:envFor(wrapped),request:signedRequest(event)});assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_outbox WHERE order_id='cs_test_recovery'").get().n,2)}finally{globalThis.fetch=prior;sql.close()}
})

test('reservation rollback protects whole baskets and inventory edits cannot invalidate holds',async()=>{
 const {reserveCheckout}=await import('../functions/lib/checkout-state.mjs')
 const {sql,db}=commerceFixture()
 try{
  await assert.rejects(reserveCheckout(db,{id:'cs_bad',expires_at:1},fixtureAddress,[{id:1,quantity:1},{id:999,quantity:1}]),/another shopper/)
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM checkout_reservations').get().n,0)
  await reserveCheckout(db,{id:'cs_good',expires_at:1},fixtureAddress,[{id:1,quantity:1}])
  assert.throws(()=>sql.exec('UPDATE skus SET quantity=0 WHERE id=1'),/reserved/)
  const {readCheckoutCart}=await import('../functions/lib/cart.mjs')
  await assert.rejects(readCheckoutCart(db,[{skuId:1,quantity:1}]),/out of stock/)
 }finally{sql.close()}
})

test('elapsed checkout time releases only provider-confirmed expired holds, never processing payments',async()=>{
 const {reserveCheckout,reconcileExpiredCheckouts}=await import('../functions/lib/checkout-state.mjs')
 const {sql,db}=commerceFixture();sql.exec('UPDATE skus SET quantity=2 WHERE id=1')
 try{
  await reserveCheckout(db,{id:'cs_expired',expires_at:1},fixtureAddress,[{id:1,quantity:1}])
  await reserveCheckout(db,{id:'cs_processing',expires_at:1},fixtureAddress,[{id:1,quantity:1}])
  await reconcileExpiredCheckouts(db,{checkout:{sessions:{retrieve:async id=>({id,status:id==='cs_expired'?'expired':'complete',payment_status:'unpaid'})}}})
  assert.deepEqual(sql.prepare('SELECT session_id,status FROM checkout_reservations ORDER BY session_id').all().map(r=>({...r})),[{session_id:'cs_expired',status:'released'},{session_id:'cs_processing',status:'active'}])
  const {readCheckoutCart}=await import('../functions/lib/cart.mjs');assert.equal((await readCheckoutCart(db,[{skuId:1,quantity:1}])).length,1)
  await assert.rejects(readCheckoutCart(db,[{skuId:1,quantity:2}]),/only 1 available/)
 }finally{sql.close()}
})

test('simultaneous signed payment webhooks create one order, consume one hold, and retain the priced delivery address',async()=>{
 const {reserveCheckout}=await import('../functions/lib/checkout-state.mjs')
 const {sql,db}=commerceFixture();const prior=globalThis.fetch
 const session={id:'cs_test_concurrent',payment_intent:'pi_fixture',status:'complete',payment_status:'paid',metadata:{store:'salty-lamps',checkout_version:'2'},customer_details:{email:fixtureAddress.email},amount_total:1500,currency:'gbp',shipping_details:{name:'Wrong',address:{line1:'Changed address',postal_code:'SW1A 1AA'}}}
 const event={id:'evt_concurrent',type:'checkout.session.completed',data:{object:session}}
 await reserveCheckout(db,{id:session.id,expires_at:1},fixtureAddress,[{id:1,quantity:1}])
 globalThis.fetch=async url=>String(url).includes('/line_items')?json({data:[{id:'li_1',quantity:1,price:{unit_amount:1000,product:{metadata:{sku_id:'1'}}}}],has_more:false}):json({latest_charge:{payment_method_details:{type:'card'}}})
 try{
  const results=await Promise.all([webhook({env:envFor(db),request:signedRequest(event)}),webhook({env:envFor(db),request:signedRequest(event)})]);assert.ok(results.some(r=>r.status===200))
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n,1);assert.equal(sql.prepare('SELECT quantity FROM skus').get().quantity,0)
  const order=sql.prepare('SELECT ship_line1,ship_postcode FROM orders').get();assert.equal(order.ship_line1,fixtureAddress.line1);assert.equal(order.ship_postcode,fixtureAddress.postcode)
  assert.equal(sql.prepare('SELECT status FROM checkout_reservations').get().status,'consumed')
  assert.equal((await webhook({env:envFor(db),request:signedRequest(event)})).status,200)
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM email_outbox').get().n,2)
 }finally{globalThis.fetch=prior;sql.close()}
})

test('signed asynchronous payment failure releases only its reservation after provider confirmation',async()=>{
 const {reserveCheckout}=await import('../functions/lib/checkout-state.mjs')
 const {sql,db}=commerceFixture();sql.exec('UPDATE skus SET quantity=2 WHERE id=1');const prior=globalThis.fetch
 await reserveCheckout(db,{id:'cs_failed',expires_at:1},fixtureAddress,[{id:1,quantity:1}]);await reserveCheckout(db,{id:'cs_other',expires_at:1},fixtureAddress,[{id:1,quantity:1}])
 globalThis.fetch=async url=>String(url).includes('/payment_intents/')?json({status:'requires_payment_method'}):json({id:'cs_failed',status:'complete',payment_status:'unpaid',payment_intent:'pi_failed'})
 try{const event={type:'checkout.session.async_payment_failed',data:{object:{id:'cs_failed',metadata:{store:'salty-lamps'}}}};assert.equal((await webhook({env:envFor(db),request:signedRequest(event)})).status,200);assert.equal(sql.prepare("SELECT status FROM checkout_reservations WHERE session_id='cs_failed'").get().status,'released');assert.equal(sql.prepare("SELECT status FROM checkout_reservations WHERE session_id='cs_other'").get().status,'active');assert.equal(sql.prepare('SELECT quantity FROM skus').get().quantity,2)}finally{globalThis.fetch=prior;sql.close()}
})

test('failed provider session creation leaves no inventory reservation',async()=>{
 const {sql,db}=commerceFixture();const prior=globalThis.fetch
 globalThis.fetch=async url=>String(url).endsWith('/v1/customers')?json({id:'cus_fixture'}):new Response(JSON.stringify({error:{message:'injected invalid request',type:'invalid_request_error'}}),{status:400,headers:{'content-type':'application/json'}})
 try{assert.equal((await buy(envFor(db))).status,503);assert.equal(sql.prepare('SELECT COUNT(*) n FROM checkout_reservations').get().n,0);assert.equal(sql.prepare('SELECT quantity FROM skus').get().quantity,1)}finally{globalThis.fetch=prior;sql.close()}
})

test('refund events follow current provider state and notify only once after a full successful refund',async()=>{
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,payment_intent,status,amount_total_pence,customer_email) VALUES('cs_refund_events','pi_fixture','paid',1500,'buyer@example.invalid')")
 const prior=globalThis.fetch;let refundStatus='pending',refundId='re_event'
 globalThis.fetch=async url=>json(new URL(String(url)).pathname.endsWith('/refunds')?{data:[],has_more:false}:{id:refundId,status:refundStatus,amount:1500,payment_intent:'pi_fixture'})
 try{
  const event={type:'refund.updated',data:{object:{id:'re_event'}}}
  assert.equal((await webhook({env:envFor(db),request:signedRequest(event)})).status,200);assert.equal(sql.prepare('SELECT status FROM orders').get().status,'paid')
  refundStatus='failed';assert.equal((await webhook({env:envFor(db),request:signedRequest(event)})).status,200);assert.equal(sql.prepare('SELECT status FROM orders').get().status,'paid');assert.equal(sql.prepare('SELECT status FROM order_refunds').get().status,'failed')
  refundId='re_retry';event.data.object.id=refundId;refundStatus='succeeded';assert.equal((await webhook({env:envFor(db),request:signedRequest(event)})).status,200);assert.equal(sql.prepare('SELECT status FROM orders').get().status,'refunded')
  await webhook({env:envFor(db),request:signedRequest(event)});assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_outbox WHERE template_key='order_refunded'").get().n,1)
 }finally{globalThis.fetch=prior;sql.close()}
})

test('provider delivery success followed by a log write failure cannot duplicate order email',async()=>{
 const {emailJobStatement,deliverOrderEmails}=await import('../functions/lib/durable-email.mjs')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status) VALUES('cs_mail','paid'); UPDATE settings SET value='1' WHERE key='email_enabled'; UPDATE settings SET value='sender@example.invalid' WHERE key='email_from_address'")
 await db.batch([emailJobStatement(db,'order:cs_mail:confirmation','cs_mail',{templateKey:'order_confirmation',to:fixtureAddress.email,orderId:'cs_mail',data:{},blocks:[]})])
 let requests=0;const keys=[];const prior=globalThis.fetch
 const failingLog={...db,batch:async statements=>{throw Error('injected log outage')}}
 globalThis.fetch=async(url,init)=>{requests++;keys.push(init.headers['Idempotency-Key']);return json({id:'mail_fixture'})}
 try{const env={...envFor(failingLog),RESEND_API_KEY:'re_fixture'};await deliverOrderEmails(env,'cs_mail','http://localhost');await deliverOrderEmails(env,'cs_mail','http://localhost');assert.equal(requests,1);assert.deepEqual(keys,['order:cs_mail:confirmation']);assert.equal(sql.prepare('SELECT status FROM commerce_email_jobs').get().status,'sent')}finally{globalThis.fetch=prior;sql.close()}
})

test('paid order write failure rolls back stock consumption and notification intent together',async()=>{
 const {reserveCheckout}=await import('../functions/lib/checkout-state.mjs')
 const {sql,db}=commerceFixture();const prior=globalThis.fetch
 const session={id:'cs_test_rollback',payment_intent:'pi_fixture',status:'complete',payment_status:'paid',metadata:{store:'salty-lamps',checkout_version:'2'},customer_details:{email:fixtureAddress.email},amount_total:1500,currency:'gbp'}
 await reserveCheckout(db,{id:session.id,expires_at:1},fixtureAddress,[{id:1,quantity:1}])
 sql.exec("CREATE TRIGGER inject_failure BEFORE INSERT ON order_notification_jobs BEGIN SELECT RAISE(ABORT,'injected write failure'); END")
 globalThis.fetch=async()=>json({data:[{id:'li_1',quantity:1,price:{unit_amount:1000,product:{metadata:{sku_id:'1'}}}}],has_more:false})
 try{const event={type:'checkout.session.completed',data:{object:session}};assert.equal((await webhook({env:envFor(db),request:signedRequest(event)})).status,500);assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.equal(sql.prepare('SELECT quantity FROM skus').get().quantity,1);assert.equal(sql.prepare('SELECT status FROM checkout_reservations').get().status,'active');assert.equal(sql.prepare('SELECT COUNT(*) n FROM order_notification_jobs').get().n,0)}finally{globalThis.fetch=prior;sql.close()}
})

test('uncertain email delivery retries with the same provider key and stops before its deduplication window expires',async()=>{
 const {emailJobStatement,deliverOrderEmails}=await import('../functions/lib/durable-email.mjs')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status) VALUES('cs_timeout','paid'); UPDATE settings SET value='1' WHERE key='email_enabled'; UPDATE settings SET value='sender@example.invalid' WHERE key='email_from_address'")
 await db.batch([emailJobStatement(db,'order:cs_timeout:confirmation','cs_timeout',{templateKey:'order_confirmation',to:fixtureAddress.email,orderId:'cs_timeout',data:{},blocks:[]})])
 const keys=[];const prior=globalThis.fetch
 globalThis.fetch=async(url,init)=>{keys.push(init.headers['Idempotency-Key']);if(keys.length===1)throw Error('provider response lost after acceptance');return json({id:'mail_same'})}
 try{const env={...envFor(db),RESEND_API_KEY:'re_fixture'};await assert.rejects(deliverOrderEmails(env,'cs_timeout','http://localhost'),/retry/);await deliverOrderEmails(env,'cs_timeout','http://localhost');assert.deepEqual(keys,['order:cs_timeout:confirmation','order:cs_timeout:confirmation']);sql.exec("UPDATE commerce_email_jobs SET status='sending',lease_until=0,first_attempt_at=1");await assert.rejects(deliverOrderEmails(env,'cs_timeout','http://localhost'),/reconciliation/);assert.equal(keys.length,2);assert.equal(sql.prepare('SELECT status FROM commerce_email_jobs').get().status,'review')}finally{globalThis.fetch=prior;sql.close()}
})

test('a lost checkout response resumes the same payable session, and changed details expire the previous hold',async()=>{
 const {sql,db}=commerceFixture();const prior=globalThis.fetch;const sessions=new Map();const byKey=new Map();let created=0
 globalThis.fetch=async(url,init)=>{
  const path=new URL(String(url)).pathname
  if(path.endsWith('/customers'))return json({id:'cus_attempt'})
  if(path.endsWith('/expire')){const id=path.split('/').at(-2);sessions.get(id).status='expired';return json(sessions.get(id))}
  if(init.method==='POST'){
   const key=init.headers['Idempotency-Key'] || init.headers['idempotency-key'];if(byKey.has(key))return json(byKey.get(key))
   const session={id:`cs_attempt_${++created}`,status:'open',payment_status:'unpaid',client_secret:`secret_${created}`,expires_at:Math.floor(Date.now()/1000)+2100};sessions.set(session.id,session);byKey.set(key,session);return json(session)
  }
  return json(sessions.get(path.split('/').at(-1)))
 }
 const attempt='11111111-1111-4111-8111-111111111111',replacement='22222222-2222-4222-8222-222222222222'
 const body={checkoutAttemptId:attempt,address:fixtureAddress,postcode:fixtureAddress.postcode,items:[{skuId:1,quantity:1}]}
 try{
  const first=await checkout({env:envFor(db),request:fixtureRequest('/api/checkout',body)});assert.equal(first.status,200);const a=await first.json()
  const again=await checkout({env:envFor(db),request:fixtureRequest('/api/checkout',body)});assert.equal(again.status,200);assert.equal((await again.json()).sessionId,a.sessionId);assert.equal(created,1)
  const changed={...body,address:{...fixtureAddress,line1:'2 Different Road'}}
  assert.equal((await checkout({env:envFor(db),request:fixtureRequest('/api/checkout',changed)})).status,409)
  const next=await checkout({env:envFor(db),request:fixtureRequest('/api/checkout',{...changed,checkoutAttemptId:replacement,previousCheckoutAttemptId:attempt})});assert.equal(next.status,200);assert.equal(created,2);assert.equal(sql.prepare("SELECT status FROM checkout_reservations WHERE session_id=?").get(a.sessionId).status,'released')
  sessions.get((await next.json()).sessionId).status='complete'
  const refused=await checkout({env:envFor(db),request:fixtureRequest('/api/checkout',{...changed,checkoutAttemptId:'33333333-3333-4333-8333-333333333333',previousCheckoutAttemptId:replacement})});assert.equal(refused.status,409);assert.equal((await refused.json()).code,'checkout_in_progress');assert.equal(created,2)
 }finally{globalThis.fetch=prior;sql.close()}
})

test('cumulative partial refunds and a late failed old attempt cannot reverse a fully refunded order',async()=>{
 const {syncRefund}=await import('../functions/lib/refunds.mjs')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,payment_intent,status,amount_total_pence,customer_email) VALUES('cs_multi','pi_multi','paid',1500,'buyer@example.invalid')")
 let total=500;const stripe={refunds:{list:async()=>({data:total===500?[]:[{id:'re_first',status:'succeeded',amount:500},{id:'re_second',status:'succeeded',amount:1000}],has_more:false})}}
 try{
  await syncRefund(envFor(db),{id:'re_first',status:'succeeded',amount:500,payment_intent:'pi_multi'},'http://localhost',stripe);assert.equal(sql.prepare('SELECT status FROM orders').get().status,'paid')
  total=1500;await syncRefund(envFor(db),{id:'re_second',status:'succeeded',amount:1000,payment_intent:'pi_multi'},'http://localhost',stripe);assert.equal(sql.prepare('SELECT status FROM orders').get().status,'refunded')
  await syncRefund(envFor(db),{id:'re_old_failed',status:'failed',amount:1500,payment_intent:'pi_multi'},'http://localhost',stripe);assert.equal(sql.prepare('SELECT status FROM orders').get().status,'refunded');assert.equal(sql.prepare('SELECT status FROM order_refunds').get().status,'succeeded');assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_outbox WHERE template_key='order_refunded'").get().n,1)
 }finally{sql.close()}
})

test('a successful refund that later fails restores the paid balance and cannot be revived by a stale event',async()=>{
 const {syncRefund}=await import('../functions/lib/refunds.mjs')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,payment_intent,status,amount_total_pence,customer_email) VALUES('cs_reversed','pi_reversed','paid',1500,'buyer@example.invalid')")
 let status='succeeded'
 const current=()=>({id:'re_reversed',status,amount:1500,payment_intent:'pi_reversed'})
 const stripe={refunds:{list:async()=>({data:[current()],has_more:false})}}
 try{
  await syncRefund(envFor(db),current(),'http://localhost',stripe)
  assert.equal(sql.prepare('SELECT status FROM orders').get().status,'refunded')
  sql.prepare("UPDATE commerce_email_jobs SET status='failed',error='temporary outage' WHERE id='refund:cs_reversed:confirmation'").run()
  status='failed';await syncRefund(envFor(db),current(),'http://localhost',stripe)
  assert.equal(sql.prepare('SELECT status FROM orders').get().status,'paid')
  assert.deepEqual({...sql.prepare('SELECT status,amount_pence FROM order_refunds').get()},{status:'failed',amount_pence:0})
  assert.equal(sql.prepare("SELECT status FROM commerce_email_jobs WHERE id='refund:cs_reversed:confirmation'").get().status,'skipped')
  status='succeeded';await syncRefund(envFor(db),current(),'http://localhost',stripe)
  assert.equal(sql.prepare('SELECT status FROM orders').get().status,'paid')
  assert.equal(sql.prepare('SELECT status FROM order_refund_records').get().status,'failed')
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_outbox WHERE template_key='order_refunded'").get().n,1)
 }finally{sql.close()}
})

test('a failed part of a full refund leaves only the successful portion returned without changing fulfilment',async()=>{
 const {syncRefund}=await import('../functions/lib/refunds.mjs')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,payment_intent,status,amount_total_pence,fulfilment_status) VALUES('cs_partial_failure','pi_partial_failure','paid',1500,'shipped')")
 const first={id:'re_kept',status:'succeeded',amount:500,payment_intent:'pi_partial_failure'}
 const second={id:'re_later_failed',status:'succeeded',amount:1000,payment_intent:'pi_partial_failure'}
 const stripe={refunds:{list:async()=>({data:[first,second],has_more:false})}}
 try{
  await syncRefund(envFor(db),second,'http://localhost',stripe)
  second.status='failed';await syncRefund(envFor(db),second,'http://localhost',stripe)
  assert.deepEqual({...sql.prepare('SELECT status,amount_pence FROM order_refunds').get()},{status:'partial',amount_pence:500})
  assert.deepEqual({...sql.prepare('SELECT status,fulfilment_status FROM orders').get()},{status:'paid',fulfilment_status:'shipped'})
  assert.equal(sql.prepare('SELECT quantity FROM skus').get().quantity,1)
 }finally{sql.close()}
})

test('owner sees pre-send preparation failures and uncertain deliveries without exposing customer payloads',async()=>{
 const {onRequestGet}=await import('../functions/api/admin/emails/outbox.js')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status) VALUES('cs_queue','paid'); INSERT INTO order_notification_jobs(order_id,payload) VALUES('cs_queue','{}'); INSERT INTO commerce_email_jobs(id,order_id,payload,status) VALUES('order:cs_queue:confirmation','cs_queue','{\"private\":\"customer address\"}','review')")
 try{const response=await onRequestGet({env:envFor(db),request:new Request('http://localhost/api/admin/emails/outbox')});assert.equal(response.status,200);const body=await response.json();assert.equal(body.preparationJobs.length,1);assert.equal(body.deliveryJobs[0].status,'review');assert.equal(body.deliveryJobs[0].idempotencyKey,'order:cs_queue:confirmation');assert.doesNotMatch(JSON.stringify(body),/customer address/)}finally{sql.close()}
})

test('a definitive Stripe refund refusal is visible as failed and a retry uses a new operation key',async()=>{
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,payment_intent,status,amount_total_pence) VALUES('cs_refused','pi_refused','paid',1500)")
 const prior=globalThis.fetch;const keys=[]
 globalThis.fetch=async(url,init)=>{keys.push(init.headers['Idempotency-Key'] || init.headers['idempotency-key']);return new Response(JSON.stringify({error:{type:'invalid_request_error',message:'Payment has no refundable balance'}}),{status:400,headers:{'content-type':'application/json'}})}
 const ctx=()=>({params:{id:'cs_refused'},request:fixtureRequest('/api/admin/orders/cs_refused',{status:'refunded'},'PATCH'),env:envFor(db),data:{actorEmail:'fixture@example.invalid'}})
 try{assert.equal((await patchOrder(ctx())).status,502);assert.equal(sql.prepare('SELECT status FROM order_refunds').get().status,'failed');assert.equal((await patchOrder(ctx())).status,502);assert.notEqual(keys[0],keys[1]);assert.equal(sql.prepare('SELECT status FROM orders').get().status,'paid')}finally{globalThis.fetch=prior;sql.close()}
})

test('manual retry of a failed activity entry cannot resend a durable email already recovered automatically',async()=>{
 const {emailJobStatement,deliverOrderEmails}=await import('../functions/lib/durable-email.mjs')
 const {onRequestPost:resend}=await import('../functions/api/admin/emails/outbox/[id]/resend.js')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status) VALUES('cs_manual','paid'); UPDATE settings SET value='1' WHERE key='email_enabled'; UPDATE settings SET value='sender@example.invalid' WHERE key='email_from_address'")
 await db.batch([emailJobStatement(db,'order:cs_manual:confirmation','cs_manual',{templateKey:'order_confirmation',to:fixtureAddress.email,orderId:'cs_manual',data:{},blocks:[]})])
 const prior=globalThis.fetch;let requests=0
 globalThis.fetch=async()=>{if(++requests===1)throw Error('temporary failure');return json({id:'mail_recovered'})}
 try{const env={...envFor(db),RESEND_API_KEY:'re_fixture'};await assert.rejects(deliverOrderEmails(env,'cs_manual','http://localhost'));const failed=sql.prepare("SELECT id FROM email_outbox WHERE status='failed'").get();await deliverOrderEmails(env,'cs_manual','http://localhost');const response=await resend({env,params:{id:String(failed.id)},request:fixtureRequest('/api/admin/emails/outbox/retry',{}),data:{actorEmail:'fixture@example.invalid'}});assert.equal(response.status,200);assert.equal(requests,2);assert.equal((await response.json()).status,'sent')}finally{globalThis.fetch=prior;sql.close()}
})

test('retry preserves the exact provider envelope despite later email template edits',async()=>{
 const {emailJobStatement,deliverOrderEmails}=await import('../functions/lib/durable-email.mjs')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status) VALUES('cs_frozen','paid'); UPDATE settings SET value='1' WHERE key='email_enabled'; UPDATE settings SET value='sender@example.invalid' WHERE key='email_from_address'")
 await db.batch([emailJobStatement(db,'order:cs_frozen:confirmation','cs_frozen',{templateKey:'order_confirmation',to:fixtureAddress.email,orderId:'cs_frozen',data:{},blocks:[]})])
 const prior=globalThis.fetch;const payloads=[]
 globalThis.fetch=async(url,init)=>{payloads.push(init.body);if(payloads.length===1)throw Error('uncertain outcome');return json({id:'mail_frozen'})}
 try{const env={...envFor(db),RESEND_API_KEY:'re_fixture'};await assert.rejects(deliverOrderEmails(env,'cs_frozen','http://localhost'));sql.exec("UPDATE email_templates SET subject='Changed after first send' WHERE key='order_confirmation'");await deliverOrderEmails(env,'cs_frozen','http://localhost');assert.equal(payloads[0],payloads[1])}finally{globalThis.fetch=prior;sql.close()}
})

test('an owner-confirmed no-delivery recovery uses a new provider key and updated content',async()=>{
 const {emailJobStatement,deliverOrderEmails}=await import('../functions/lib/durable-email.mjs')
 const {onRequestPost:recover}=await import('../functions/api/admin/emails/outbox.js')
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status) VALUES('cs_review','paid'); UPDATE settings SET value='1' WHERE key='email_enabled'; UPDATE settings SET value='sender@example.invalid' WHERE key='email_from_address'")
 await db.batch([emailJobStatement(db,'order:cs_review:confirmation','cs_review',{templateKey:'order_confirmation',to:fixtureAddress.email,orderId:'cs_review',data:{},blocks:[]})])
 sql.exec("UPDATE commerce_email_jobs SET status='review',first_attempt_at=1")
 const prior=globalThis.fetch;const keys=[]
 globalThis.fetch=async(url,init)=>{keys.push(init.headers['Idempotency-Key']);return json({id:'mail_confirmed_retry'})}
 try{
  const env={...envFor(db),RESEND_API_KEY:'re_fixture'}
  const response=await recover({env,request:fixtureRequest('/api/admin/emails/outbox',{orderId:'cs_review',jobId:'order:cs_review:confirmation',action:'confirm_not_sent'}),data:{actorEmail:'fixture@example.invalid'}})
  assert.equal(response.status,200);assert.equal(keys.length,0)
  await deliverOrderEmails(env,'cs_review','http://localhost');assert.deepEqual(keys,['order:cs_review:confirmation:recovery:1'])
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='email.reconcile'").get().n,1)
 }finally{globalThis.fetch=prior;sql.close()}
})

test('saved cancellation has durable notification intent even if email preparation fails immediately afterward',async()=>{
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status,customer_email) VALUES('cs_cancel_durable','paid','buyer@example.invalid')")
 let failTemplates=true
 const wrapped={...db,prepare:query=>{if(failTemplates && query.includes('FROM email_templates'))throw Error('injected email preparation outage');return db.prepare(query)}}
 const ctx=()=>({env:envFor(wrapped),data:{actorEmail:'fixture@example.invalid'},params:{id:'cs_cancel_durable'},request:fixtureRequest('/api/admin/orders/cs_cancel_durable',{status:'cancelled'},'PATCH')})
 try{
  assert.equal((await patchOrder(ctx())).status,200)
  assert.equal(sql.prepare('SELECT status FROM orders').get().status,'cancelled')
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM commerce_email_jobs WHERE order_id='cs_cancel_durable'").get().n,1)
  failTemplates=false
  const {deliverOrderEmails}=await import('../functions/lib/durable-email.mjs')
  await deliverOrderEmails(envFor(db),'cs_cancel_durable','http://localhost')
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_outbox WHERE template_key='order_cancelled'").get().n,1)
  assert.equal((await patchOrder(ctx())).status,200)
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM commerce_email_jobs WHERE order_id='cs_cancel_durable'").get().n,1)
 }finally{sql.close()}
})

test('simultaneous despatch actions enqueue one notification and a failed queue insert rolls back fulfilment',async()=>{
 const {sql,db}=commerceFixture();sql.exec("INSERT INTO orders(id,status,fulfilment_status,customer_email) VALUES('cs_despatch','paid','packed','buyer@example.invalid')")
 const ctx=()=>({env:envFor(db),data:{actorEmail:'fixture@example.invalid'},params:{id:'cs_despatch'},request:fixtureRequest('/api/admin/orders/cs_despatch',{fulfilment_status:'shipped',carrier:'royal_mail',tracking_number:'FIXTURE123'},'PATCH')})
 try{
  sql.exec("CREATE TRIGGER fail_status_intent BEFORE INSERT ON commerce_email_jobs BEGIN SELECT RAISE(ABORT,'injected queue failure'); END")
  assert.equal((await patchOrder(ctx())).status,500)
  assert.equal(sql.prepare('SELECT fulfilment_status FROM orders').get().fulfilment_status,'packed')
  sql.exec('DROP TRIGGER fail_status_intent')
  const results=await Promise.all([patchOrder(ctx()),patchOrder(ctx())])
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
  assert.equal(sql.prepare('SELECT fulfilment_status FROM orders').get().fulfilment_status,'shipped')
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM commerce_email_jobs WHERE order_id='cs_despatch'").get().n,1)
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_outbox WHERE template_key='order_shipped'").get().n,1)
 }finally{sql.close()}
})
