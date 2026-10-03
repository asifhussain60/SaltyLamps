import { productionBindings } from './environment-fixture.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest as page } from '../functions/_middleware.js'
import { onRequest as api } from '../functions/api/admin/_middleware.js'
const env = { ...productionBindings,ADMIN_HOSTS:'admin.saltylamps.co.uk',PUBLIC_HOST:'www.saltylamps.co.uk',ACCESS_AUD:'expected',ACCESS_TEAM_DOMAIN:'saltylamps'}
function context(url, overrides={}, headers={}) {
 return {request:new Request(url,{headers}),env:{...env,...overrides},data:{},next:async()=>new Response('protected content')}
}
test('storefront admin bookmark preserves path on the dedicated hostname',async()=>{
 const res=await page(context('https://www.saltylamps.co.uk/admin/orders?status=paid'))
 assert.equal(res.status,301)
 assert.equal(res.headers.get('location'),'https://admin.saltylamps.co.uk/admin/orders?status=paid')
})
test('direct admin pages and APIs require valid Access even with obsolete bypass flags',async()=>{
 for(const [handler,path] of [[page,'/admin/orders'],[page,'/admin/welcome'],[page,'/admin/launch-checklist'],[api,'/api/admin/orders'],[api,'/api/admin/wix-records'],[api,'/api/admin/launch-review']]) {
  const res=await handler(context('https://admin.saltylamps.co.uk'+path,{ADMIN_OPEN_HOSTS:'admin.saltylamps.co.uk',DEV_ADMIN_BYPASS:'1'}))
  assert.equal(res.status,401)
  assert.match(res.headers.get('cache-control'),/no-store/)
  assert.doesNotMatch(await res.text(),/protected content/)
  const forged=await handler(context('https://admin.saltylamps.co.uk'+path,{}, {'Cf-Access-Jwt-Assertion':'forged'}))
  assert.equal(forged.status,401)
 }
})
test('missing Access configuration fails closed for administrator HTML',async()=>{
 const res=await page(context('https://admin.saltylamps.co.uk/admin',{ACCESS_AUD:''}))
 assert.equal(res.status,503)
})
test('storefront and deployment aliases cannot serve administrator data',async()=>{
 for(const host of ['saltylamps.co.uk','www.saltylamps.co.uk','salty-lamps-proposal.pages.dev','preview.salty-lamps.pages.dev']){
  const res=await api(context('https://'+host+'/api/admin/orders'))
  assert.equal(res.status,404)
 }
})
