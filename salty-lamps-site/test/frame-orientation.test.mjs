import test from 'node:test'
import assert from 'node:assert/strict'
import { normaliseCart, readCheckoutCart } from '../functions/lib/cart.mjs'
import { reserveCheckout, releaseCheckout, checkoutFingerprint } from '../functions/lib/checkout-state.mjs'
import { commerceFixture, fixtureAddress } from './helpers/commerce-fixture.mjs'
import { FRAME_PRODUCT_ID, frameChoicesFromMetadata, formatFrameChoices } from '../functions/lib/frame-orientation.mjs'
import { changeCartOption, reconcilePurchasedCart } from '../src/content/cart-session.mjs'

test('mixed frame choices remain distinct while stock reservations aggregate by size', async () => {
  const {db,sql}=commerceFixture()
  sql.prepare('INSERT INTO products(id,name) VALUES(?,?)').run(FRAME_PRODUCT_ID,'Frames')
  sql.prepare('UPDATE skus SET product_id=?,quantity=3 WHERE id=1').run(FRAME_PRODUCT_ID)
  const items=[{skuId:1,quantity:2,orientation:'portrait'},{skuId:1,quantity:1,orientation:'landscape'}]
  const rows=await readCheckoutCart(db,items)
  assert.equal(rows.length,1)
  assert.equal(rows[0].quantity,3)
  assert.deepEqual(rows[0].frame_choices,{portrait:2,landscape:1})
  await reserveCheckout(db,{id:'first',expires_at:2000000000},fixtureAddress,rows)
  await assert.rejects(readCheckoutCart(db,[{skuId:1,quantity:1,orientation:'landscape'}]),/out of stock/)
  await releaseCheckout(db,'first')
  assert.equal((await readCheckoutCart(db,items))[0].quantity,3)
  sql.close()
})

test('missing, invalid or inappropriate orientation is rejected before provider contact', async () => {
  const {db,sql}=commerceFixture()
  await assert.rejects(readCheckoutCart(db,[{skuId:1,quantity:1,orientation:'portrait'}]),/orientation/)
  sql.prepare('INSERT INTO products(id,name) VALUES(?,?)').run(FRAME_PRODUCT_ID,'Frames')
  sql.prepare('UPDATE skus SET product_id=? WHERE id=1').run(FRAME_PRODUCT_ID)
  await assert.rejects(readCheckoutCart(db,[{skuId:1,quantity:1}]),/orientation/)
  assert.throws(()=>normaliseCart([{skuId:1,quantity:1,orientation:'sideways'}]),/orientation/)
  sql.close()
})

test('orientation metadata preserves fulfilment quantities and rejects mismatched totals',()=>{
  const choices=frameChoicesFromMetadata('{"portrait":2,"landscape":1}',3)
  assert.equal(formatFrameChoices(choices),'Portrait × 2, Landscape × 1')
  assert.throws(()=>frameChoicesFromMetadata('{"portrait":2}',3),/quantity/)
  assert.throws(()=>frameChoicesFromMetadata('{"sideways":3}',3),/orientation/)
  assert.deepEqual(frameChoicesFromMetadata(undefined,3),{})
})

test('checkout identity changes with orientation, but not input line order',()=>{
  const a=[{skuId:1,quantity:2,orientation:'portrait'},{skuId:1,quantity:1,orientation:'landscape'}]
  assert.equal(checkoutFingerprint({},normaliseCart(a)),checkoutFingerprint({},normaliseCart([...a].reverse())))
  assert.notEqual(checkoutFingerprint({},normaliseCart(a)),checkoutFingerprint({},normaliseCart([{skuId:1,quantity:3,orientation:'portrait'}])))
})

test('basket size changes preserve orientation and enforce the shared size limit',()=>{
  const small={id:'sku-1',skuId:1,productId:FRAME_PRODUCT_ID,name:'Small',stock:true,stockQty:4}
  const large={...small,id:'sku-2',skuId:2,name:'Large',stockQty:3}
  const cart=[{key:'sku-1:portrait',product:small,qty:2,orientation:'portrait'},{key:'sku-2:landscape',product:large,qty:2,orientation:'landscape'}]
  assert.match(changeCartOption(cart,cart[0].key,large).error,/Only 3/)
  const updated=changeCartOption([{...cart[0],qty:1},cart[1]],cart[0].key,large)
  assert.equal(updated.cart.length,2)
  assert.equal(updated.cart[0].orientation,'portrait')
})

test('returning from payment removes only the purchased orientation',()=>{
  const cart=[{key:'sku-1:portrait',product:{skuId:1},qty:3,orientation:'portrait'},{key:'sku-1:landscape',product:{skuId:1},qty:2,orientation:'landscape'}]
  const remaining=reconcilePurchasedCart(cart,[{skuId:1,quantity:2,orientation:'portrait'}])
  assert.deepEqual(remaining.map(i=>[i.orientation,i.qty]),[['portrait',1],['landscape',2]])
})

test('checkout and signed webhook retain choices once through payment, order and receipt data',async()=>{
  const {onRequestPost: checkout}=await import('../functions/api/checkout.js')
  const {onRequestPost: webhook}=await import('../functions/api/webhook.js')
  const {orderVariant}=await import('../functions/lib/frame-orientation.mjs')
  const {default:Stripe}=await import('stripe')
  const {sql,db}=commerceFixture()
  sql.prepare('INSERT INTO products(id,name) VALUES(?,?)').run(FRAME_PRODUCT_ID,'Frames')
  sql.prepare('UPDATE skus SET product_id=?,quantity=3 WHERE id=1').run(FRAME_PRODUCT_ID)
  const env={DB:db,STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_PUBLISHABLE_KEY:'pk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture'}
  const prior=globalThis.fetch
  let sent
  const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
  globalThis.fetch=async(url,init)=>{
    const path=new URL(String(url)).pathname
    if(path==='/v1/customers')return response({id:'cus_fixture'})
    if(path==='/v1/checkout/sessions'){
      sent=new URLSearchParams(init.body)
      return response({id:'cs_test_frame',client_secret:'fixture',expires_at:2000000000})
    }
    if(path.endsWith('/line_items'))return response({data:[{quantity:3,price:{unit_amount:1000,product:{metadata:{sku_id:'1',frame_choices:sent.get('line_items[0][price_data][product_data][metadata][frame_choices]')}}}}],has_more:false})
    if(path.startsWith('/v1/payment_intents/'))return response({latest_charge:{payment_method_details:{type:'card'}}})
    throw Error('Unexpected external call '+path)
  }
  try{
    const body={address:fixtureAddress,postcode:fixtureAddress.postcode,items:[{skuId:1,quantity:2,orientation:'portrait'},{skuId:1,quantity:1,orientation:'landscape'}]}
    assert.equal((await checkout({env,request:new Request('http://localhost/api/checkout',{method:'POST',body:JSON.stringify(body)})})).status,200)
    assert.equal(sent.get('line_items[0][quantity]'),'3')
    assert.match(sent.get('line_items[0][price_data][product_data][name]'),/Portrait × 2, Landscape × 1/)
    const session={id:'cs_test_frame',payment_intent:'pi_fixture',status:'complete',payment_status:'paid',metadata:{store:'salty-lamps',checkout_version:'2'},customer_details:{email:fixtureAddress.email},amount_total:3500,currency:'gbp'}
    const payload=JSON.stringify({id:'evt_frame',type:'checkout.session.completed',data:{object:session}})
    const signed=()=>new Request('http://localhost/api/webhook',{method:'POST',body:payload,headers:{'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_fixture'})}})
    assert.equal((await webhook({env,request:signed()})).status,200)
    assert.equal((await webhook({env,request:signed()})).status,200)
    const rows=sql.prepare('SELECT * FROM order_items').all()
    assert.equal(rows.length,1)
    assert.equal(orderVariant(rows[0]),'Portrait × 2, Landscape × 1')
    assert.equal(sql.prepare('SELECT quantity FROM skus WHERE id=1').get().quantity,0)
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM email_outbox').get().n,2)
    const jobs=sql.prepare('SELECT payload FROM commerce_email_jobs').all()
    assert.ok(jobs.some(job=>job.payload.includes('Portrait × 2, Landscape × 1')))
  }finally{globalThis.fetch=prior;sql.close()}
})
