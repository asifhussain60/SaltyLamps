import test from 'node:test'
import assert from 'node:assert/strict'
import {nextCheckoutAttempt, checkoutPayload} from '../src/content/checkout-attempt.mjs'
const address={email:'Buyer@Example.com ',name:'Example',line1:'10 High St',line2:'',city:'London',postcode:'sw1a 2aa'}
test('retries retain their identity and address or basket changes replace the previous attempt explicitly',()=>{
 const payload=checkoutPayload([{skuId:2,quantity:1},{skuId:1,quantity:2}],address)
 const first=nextCheckoutAttempt(null,payload)
 assert.match(first.checkoutAttemptId,/^[0-9a-f-]{36}$/)
 assert.deepEqual(nextCheckoutAttempt(first,checkoutPayload([...payload.items].reverse(),{...address,email:'buyer@example.com',postcode:'SW1A 2AA'})),first)
 const second=nextCheckoutAttempt(first,checkoutPayload(payload.items,{...address,line1:'20 High St'}))
 assert.notEqual(second.checkoutAttemptId,first.checkoutAttemptId)
 assert.equal(second.previousCheckoutAttemptId,first.checkoutAttemptId)
 const retry=nextCheckoutAttempt(JSON.parse(JSON.stringify(second)),checkoutPayload(payload.items,{...address,line1:'20 High St'}))
 assert.deepEqual(retry,second)
})
