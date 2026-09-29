import {test,expect} from '@playwright/test'
const categories=[{slug:'salt-lamps',name:'Lamp fixtures',description:'Original',image:'',theme:'lamp',sort_order:1,visible:1,product_count:0},{slug:'accessories',name:'Accessory fixtures',description:'Other',image:'',theme:'lamp',sort_order:2,visible:1,product_count:0}]
async function categoryPage(page) {
 await page.route('**/api/admin/categories',r=>r.fulfill({json:{categories}}))
 await page.goto('/admin')
 await expect(page.locator('.admin-shell')).toBeVisible()
 const menu=page.getByRole('button',{name:'Toggle menu',exact:true})
 if(await menu.isVisible())await menu.click()
 await page.locator('.admin-nav a[href="/admin/categories"]').click()
 await page.getByRole('row',{name:/Lamp fixtures/}).getByRole('button',{name:'Edit',exact:true}).click()
 await page.getByLabel('Name',{exact:true}).fill('Unsaved fixture')
}
test('switching category drafts requires consent and preserves declined edits',async({page})=>{
 await categoryPage(page)
 let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss()})
 await page.getByRole('row',{name:/Accessory fixtures/}).getByRole('button',{name:'Edit',exact:true}).click()
 expect(dialogs).toBe(1)
 await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved fixture')
 await page.getByRole('button',{name:'New category',exact:true}).click()
 expect(dialogs).toBe(2)
 await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved fixture')
})
test('native Back can be declined repeatedly then accepted without corrupting Forward',async({page})=>{
 await categoryPage(page)
 let accept=false,dialogs=0;page.on('dialog',async d=>{dialogs++;await (accept?d.accept():d.dismiss())})
 for(let i=0;i<2;i++) {
  await page.evaluate(()=>history.back())
  await expect.poll(()=>dialogs).toBe(i+1)
  await expect(page).toHaveURL(/\/admin\/categories$/)
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Unsaved fixture')
  await page.waitForTimeout(100)
 }
 accept=true
 await page.evaluate(()=>history.back())
 await expect(page).toHaveURL(/\/admin$/)
 await page.evaluate(()=>history.forward())
 await expect(page).toHaveURL(/\/admin\/categories$/)
 await expect(page.getByRole('heading',{name:'Categories',exact:true})).toBeVisible()
})
test('photo navigation retains keyboard focus until the viewer closes',async({page,request})=>{
 const data=await(await request.get('/api/products')).json()
 const product={...data.products[0],images:[data.products[0].image,'/media/salt-tiles.png','/media/kitchen-setup.png']}
 await page.route('**/api/products',r=>r.fulfill({json:{...data,products:[product]}}))
 await page.goto(`/product-page/${product.slug}`)
 const opener=page.getByRole('button',{name:/Enlarge.*photo/})
 await opener.click()
 const next=page.getByRole('button',{name:'Next photo'})
 await next.focus();await page.keyboard.press('Enter')
 await expect(page.getByRole('dialog').getByText('2 of 3')).toBeVisible()
 await expect(next).toBeFocused()
 await page.keyboard.press('Enter')
 await expect(page.getByRole('dialog').getByText('3 of 3')).toBeVisible()
 await expect(next).toBeFocused()
 await page.keyboard.press('Escape');await expect(opener).toBeFocused()
})
test('payment load failure offers a retry and a return to the address',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('salty-lamps-pending-checkout',JSON.stringify({sessionId:'cs_test_audit',clientSecret:'cs_test_audit_secret_fixture',publishableKey:'pk_test_fixture',items:[]})))
 await page.route('https://js.stripe.com/**',r=>r.abort())
 await page.goto('/checkout/payment')
 await expect(page.getByRole('alert')).toContainText('could not load')
 await expect(page.getByRole('button',{name:'Retry payment form'})).toBeVisible()
 await page.getByRole('link',{name:'Return to delivery address'}).click()
 await expect(page).toHaveURL(/\/checkout\/address$/)
})

test('a committed product save with a lost response is recovered without creating duplicates',async({page,request})=>{
 test.skip(!/127\.0\.0\.1|localhost/.test(test.info().project.use.baseURL || process.env.E2E_BASE_URL || 'http://127.0.0.1:8788'),'Disposable local database only')
 const name=`Audit save ${crypto.randomUUID()}`
 let savedId,first=true
 await page.route('**/api/admin/products/save',async route=>{
  if(!first)return route.continue()
  first=false
  const response=await route.fetch();expect(response.ok()).toBe(true);savedId=(await response.json()).id
  await route.abort('failed')
 })
 try{
  await page.goto('/admin/products/new')
  await page.getByLabel('Name',{exact:true}).fill(name)
  await page.getByLabel('SKU code',{exact:true}).fill('AUDIT-SAVE')
  await page.getByLabel('Price (£)',{exact:true}).fill('12.50')
  await page.getByRole('button',{name:'Create product',exact:true}).click()
  await expect(page.getByRole('button',{name:'Retry save',exact:true})).toBeVisible()
  await expect(page.getByLabel('Name',{exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Retry save',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`/admin/products/${savedId}$`))
  const rows=(await(await request.get('/api/admin/products')).json()).products.filter(p=>p.name===name)
  expect(rows).toHaveLength(1);expect(rows[0].skus).toHaveLength(1)
 }finally{if(savedId)await request.delete(`/api/admin/products/${savedId}`)}
})

test('checkout retries retain the same attempt and changed addresses explicitly replace it',async({page,request})=>{
 const products=(await(await request.get('/api/products')).json()).products
 const product=products.find(p=>p.stock)
 await page.addInitScript(skuId=>sessionStorage.setItem('salty-lamps-cart',JSON.stringify([{skuId,qty:1}])),product.skuId)
 const payloads=[]
 await page.route('**/api/checkout',async route=>{
  payloads.push(route.request().postDataJSON())
  if(payloads.length===1)return route.abort('failed')
  return route.fulfill({status:503,json:{error:'Fixture unavailable'}})
 })
 await page.goto('/checkout/address')
 await page.getByLabel('Email address').fill('buyer@example.com')
 await page.getByLabel('Full name').fill('Example Buyer')
 await page.getByLabel('Address line 1').fill('10 High Street')
 await page.getByLabel('Town or city').fill('London')
 await page.getByLabel('Postcode',{exact:true}).fill('SW1A 2AA')
 const pay=page.getByRole('button',{name:'Continue to payment',exact:true})
 await pay.click();await expect(page.getByRole('main').locator('.notice[role="status"]')).toContainText('Your basket is saved')
 await pay.click();await expect(page.getByRole('main').locator('.notice[role="status"]')).toContainText('Fixture unavailable')
 expect(payloads[1].checkoutAttemptId).toBe(payloads[0].checkoutAttemptId)
 await page.getByLabel('Address line 1').fill('20 High Street')
 await pay.click();await expect.poll(()=>payloads.length).toBe(3)
 expect(payloads[2].checkoutAttemptId).not.toBe(payloads[1].checkoutAttemptId)
 expect(payloads[2].previousCheckoutAttemptId).toBe(payloads[1].checkoutAttemptId)
})

test('unfinished email delivery remains visible without claiming completion',async({page})=>{
 await page.route('**/api/admin/emails/outbox?*',route=>route.fulfill({json:{rows:[],deliveryJobs:[{id:7,order_id:'fixture-order',status:'review',error:'Response uncertain',idempotencyKey:'fixture-safe-key',instructions:'Confirm delivery with the provider before retrying.'}],preparationJobs:[{order_id:'fixture-prepare',status:'preparing',instructions:'Retry preparation.'}]}}))
 await page.goto('/admin/emails')
 await page.getByRole('button',{name:'Activity',exact:true}).click()
 await expect(page.getByText('Response uncertain',{exact:false})).toBeVisible()
 await expect(page.getByText('fixture-safe-key',{exact:false})).toBeVisible()
 await expect(page.getByRole('button',{name:'Retry unfinished delivery'})).toHaveCount(1)
})

test('partial refunds retain the paid state and show the amount already returned',async({page,request})=>{
 const list=await(await request.get('/api/admin/orders')).json()
 test.skip(!list.orders?.length,'No orders in this disposable database')
 const id=list.orders[0].id
 const detail=await(await request.get(`/api/admin/orders/${id}`)).json()
 await page.route(`**/api/admin/orders/${id}`,route=>route.fulfill({json:{...detail,order:{...detail.order,status:'paid',refund_status:'partial',refunded_amount_pence:200}}}))
 await page.goto(`/admin/orders/${id}`)
 await expect(page.getByText('Partially refunded: £2.00.',{exact:false})).toBeVisible()
 await expect(page.getByRole('button',{name:'Refund order',exact:true})).toBeEnabled()
})

test('changing email tabs preserves an unsaved template when leaving is declined',async({page})=>{
 await page.goto('/admin/emails')
 await page.getByRole('button',{name:'Edit',exact:true}).first().click()
 await page.getByLabel('Subject line',{exact:true}).fill('Unsaved audit subject')
 let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss()})
 await page.getByRole('button',{name:'Activity',exact:true}).click()
 expect(dialogs).toBe(1)
 await expect(page.getByLabel('Subject line',{exact:true})).toHaveValue('Unsaved audit subject')
})

test('an existing product image upload can recover a lost response without duplicating its gallery',async({page,request})=>{
 test.skip(!/127\.0\.0\.1|localhost/.test(process.env.E2E_BASE_URL || 'http://127.0.0.1:8788'),'Disposable local database only')
 const created=await request.post('/api/admin/products',{data:{product:{name:`Image retry ${crypto.randomUUID()}`},skus:[{sku:'IMAGE-RETRY',price:10,track_mode:'binary',in_stock:true}]}})
 const {id}=await created.json();expect(created.ok()).toBe(true)
 let first=true
 await page.route(`**/api/admin/products/${id}/images`,async route=>{if(!first)return route.continue();first=false;const r=await route.fetch();expect(r.ok()).toBe(true);return route.abort('failed')})
 try{
  await page.goto(`/admin/products/${id}`)
  await page.locator('.admin-gallery-add input').setInputFiles({name:'retry.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])})
  await expect(page.getByRole('button',{name:'Retry image uploads'})).toBeVisible()
  await page.getByRole('button',{name:'Retry image uploads'}).click()
  await expect(page.getByRole('button',{name:'Retry image uploads'})).toHaveCount(0)
  const product=(await(await request.get('/api/admin/products')).json()).products.find(p=>p.id===id)
  expect(product.images).toHaveLength(1)
 }finally{await request.delete(`/api/admin/products/${id}`)}
})

test('product pictures reorder by arrows and drag, and the first remains the shop cover after reload',async({page,request})=>{
 test.skip(!/127\.0\.0\.1|localhost/.test(process.env.E2E_BASE_URL || 'http://127.0.0.1:8788'),'Disposable local database only')
 const created=await request.post('/api/admin/products',{data:{product:{name:`Gallery order ${crypto.randomUUID()}`},skus:[{sku:'GALLERY-ORDER',price:10,track_mode:'binary',in_stock:true}]}})
 expect(created.ok()).toBe(true)
 const {id}=await created.json()
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64')
 try {
  const photos=[]
  for(let i=0;i<2;i++){
   const uploaded=await request.post(`/api/admin/products/${id}/images`,{headers:{'Idempotency-Key':crypto.randomUUID()},multipart:{image:{name:`photo-${i}.png`,mimeType:'image/png',buffer:png}}})
   expect(uploaded.status()).toBe(201)
   photos.push(await uploaded.json())
  }
  await page.goto(`/admin/products/${id}`)
  const tiles=page.locator('.admin-gallery-item')
  await expect(tiles).toHaveCount(2)
  await tiles.first().getByRole('button',{name:'Move image right'}).click()
  await expect.poll(async()=>((await(await request.get('/api/admin/products')).json()).products.find(p=>p.id===id)).image).toBe(photos[1].path)
  await page.reload()
  await expect(tiles.first().locator('img')).toHaveAttribute('src',photos[1].path)
  await tiles.nth(1).dragTo(tiles.first())
  await expect.poll(async()=>((await(await request.get('/api/admin/products')).json()).products.find(p=>p.id===id)).image).toBe(photos[0].path)
  await page.reload()
  await expect(tiles.first().locator('img')).toHaveAttribute('src',photos[0].path)
 }finally{await request.delete(`/api/admin/products/${id}`)}
})
