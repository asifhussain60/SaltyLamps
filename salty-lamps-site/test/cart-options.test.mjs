import test from 'node:test'
import assert from 'node:assert/strict'
import { changeCartOption } from '../src/content/cart-session.mjs'
const a={id:'sku-1',skuId:1,productId:'salt',name:'1kg salt',price:4,stock:true,stockQty:10}
const b={...a,id:'sku-2',skuId:2,name:'5kg salt',price:12,stockQty:4}
const line=(product,qty)=>({key:product.id,product,qty})
test('changing a size replaces the trusted option and preserves quantity',()=>{
 const result=changeCartOption([line(a,2)],a.id,b)
 assert.deepEqual(result.cart,[line(b,2)])
 assert.equal(result.cart[0].product.price*result.cart[0].qty,24)
})
test('matching options merge with no duplicates and reject combined quantities beyond stock',()=>{
 assert.deepEqual(changeCartOption([line(a,2),line(b,1)],a.id,b).cart,[line(b,3)])
 assert.match(changeCartOption([line(a,3),line(b,2)],a.id,b).error,/Only 4/)
})
test('unavailable, unrelated and excess binary-stock options cannot be selected',()=>{
 assert.ok(changeCartOption([line(a,2)],a.id,{...b,stock:false}).error)
 assert.ok(changeCartOption([line(a,2)],a.id,{...b,productId:'other'}).error)
 assert.ok(changeCartOption([line(a,9999),line(b,1)],a.id,{...b,stockQty:null}).error)
})
