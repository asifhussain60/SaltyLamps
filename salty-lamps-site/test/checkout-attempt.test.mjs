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
test('special instructions join the payload only when they hold text, trimmed and capped, and editing them replaces the attempt',()=>{
 const items=[{skuId:1,quantity:1}]
 const today=checkoutPayload(items,address)
 assert.deepEqual(Object.keys(today.address),['email','name','line1','line2','city','postcode'])
 for(const blank of [undefined,'','  \n\t '])assert.equal(JSON.stringify(checkoutPayload(items,{...address,instructions:blank})),JSON.stringify(today))
 assert.equal(checkoutPayload(items,{...address,instructions:'  Gift wrap please \n'}).address.instructions,'Gift wrap please')
 assert.equal(checkoutPayload(items,{...address,instructions:'x'.repeat(600)}).address.instructions,'x'.repeat(500))
 const first=nextCheckoutAttempt(null,today)
 const edited=nextCheckoutAttempt(first,checkoutPayload(items,{...address,instructions:'Gift wrap please'}))
 assert.notEqual(edited.checkoutAttemptId,first.checkoutAttemptId)
 assert.equal(edited.previousCheckoutAttemptId,first.checkoutAttemptId)
 assert.deepEqual(nextCheckoutAttempt(edited,checkoutPayload(items,{...address,instructions:' Gift wrap please\n'})),edited)
})
