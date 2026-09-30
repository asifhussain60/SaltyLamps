// Save product details and its complete option list as one atomic, replayable operation.
import { json, apiError, validationError, readJson, auditStmt, assertCategoriesExist } from '../../../lib/admin-helpers.mjs'
import { validateProduct, validateSku } from '../../../lib/validation.mjs'
import { validateWeights } from '../../../lib/weights.mjs'
import { weightStatement } from '../../../lib/postage-store.mjs'
import { checkOptionImage, optionImageStatements, parseImageId } from '../../../lib/option-images.mjs'

export async function onRequestPost({ request, env, data }) {
  const [body, error] = await readJson(request)
  if (error) return error
  if (!body || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId || '')) return apiError('A valid save request identifier is required.', 400)
  const actor = data.actorEmail || 'unknown'
  const fingerprint = JSON.stringify({ id: body.id || null, product: body.product, skus: body.skus })
  const replay = async () => {
    const saved = await env.DB.prepare('SELECT * FROM admin_save_requests WHERE request_id=?').bind(body.requestId).first()
    if (!saved) return null
    if (saved.actor_email !== actor || saved.fingerprint !== fingerprint) return apiError('This save identifier was already used for a different request. Reload before editing again.', 409)
    return json(JSON.parse(saved.result_json))
  }
  try {
    const previous = await replay()
    if (previous) return previous
    const product = validateProduct(body.product || {})
    if (!product.ok) return validationError(product.errors)
    const categories = await assertCategoriesExist(env.DB, product.value.categories)
    if (categories) return categories
    if (!Array.isArray(body.skus) || !body.skus.length || body.skus.length > 100) return apiError('A product needs between 1 and 100 options.',400)
    const id = body.id || `product_${crypto.randomUUID()}`
    if (body.id && !(await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(id).first())) return apiError('Product not found.',404)
    const {results: existing=[]} = await env.DB.prepare('SELECT s.*,w.product_weight_min_g,w.product_weight_max_g,w.packed_weight_g,w.postal_group,w.weight_public FROM skus s LEFT JOIN sku_weights w ON w.sku_id=s.id WHERE s.product_id=?').bind(id).all()
    const kept = new Set()
    const validated = []
    for (const input of body.skus) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return apiError('Each option must be an object.',400)
      const sku = validateSku(input)
      if (!sku.ok) return validationError(sku.errors)
      let old
      if (input.id != null) {
        old = existing.find(row => row.id === input.id)
        if (!old || kept.has(input.id)) return apiError('Each existing option must belong to this product and appear once.',400)
        kept.add(input.id)
      }
      let weights
      try { weights = validateWeights(input,old || {}) } catch(e) { return apiError(e.message,400) }
      const imageError = await checkOptionImage(env.DB,id,input.image_id)
      if (imageError) return imageError
      let inventoryChanged = false
      let originalInventory
      if (old) {
        originalInventory = input.originalInventory
        if (!originalInventory || !['quantity','binary'].includes(originalInventory.track_mode)
          || (originalInventory.track_mode === 'quantity' && !Number.isInteger(originalInventory.quantity))
          || ![0,1].includes(originalInventory.in_stock)) return apiError('Reload this product before saving its inventory.',400)
        inventoryChanged = sku.value.track_mode !== originalInventory.track_mode
          || sku.value.quantity !== originalInventory.quantity || sku.value.in_stock !== originalInventory.in_stock
        if (inventoryChanged && (old.track_mode !== originalInventory.track_mode
          || old.quantity !== originalInventory.quantity || old.in_stock !== originalInventory.in_stock)) return apiError('Stock changed while this product was open. Reload the product before changing its stock.',409)
      }
      validated.push({id:input.id,value:sku.value,weights,image:input.image_id,inventoryChanged,originalInventory})
    }
    const removed = existing.filter(row => !kept.has(row.id))
    for (const row of removed) {
      const ref = await env.DB.prepare('SELECT COUNT(*) c FROM order_items WHERE sku_id=?').bind(row.id).first()
      if (ref.c > 0) return apiError('An option appears on past orders and cannot be removed. Set it out of stock instead.',409)
    }
    const result = {id}
    const p = product.value
    const statements = [env.DB.prepare('INSERT INTO admin_save_requests(request_id,actor_email,fingerprint,result_json) VALUES(?,?,?,?)').bind(body.requestId,actor,fingerprint,JSON.stringify(result))]
    statements.push(body.id
      ? env.DB.prepare('UPDATE products SET name=?,slug=?,description=?,intro=CASE WHEN ? THEN ? ELSE intro END,image=?,categories=?,tags=?,visible=? WHERE id=?').bind(p.name,p.slug,p.description,body.product?.intro === undefined ? 0 : 1,p.intro,p.image,p.categories,p.tags,p.visible,id)
      : env.DB.prepare('INSERT INTO products(id,name,slug,description,intro,image,categories,tags,visible) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,p.name,p.slug,p.description,p.intro,p.image,p.categories,p.tags,p.visible))
    for (const s of validated) {
      const v=s.value
      if (s.id != null) {
        if (s.inventoryChanged) {
          const original=s.originalInventory
          // This assertion runs inside the same transaction as all product edits.
          // A sale after validation cannot be overwritten; NULL aborts the entire batch.
          statements.push(env.DB.prepare('UPDATE admin_save_requests SET result_json=CASE WHEN EXISTS(SELECT 1 FROM skus WHERE id=? AND product_id=? AND track_mode=? AND quantity IS ? AND in_stock=?) THEN result_json ELSE NULL END WHERE request_id=?').bind(s.id,id,original.track_mode,original.quantity,original.in_stock,body.requestId))
          statements.push(env.DB.prepare('UPDATE skus SET sku=?,variant_label=?,price_pence=?,track_mode=?,quantity=?,in_stock=? WHERE id=? AND product_id=?').bind(v.sku,v.variant_label,v.price_pence,v.track_mode,v.quantity,v.in_stock,s.id,id))
        } else {
          statements.push(env.DB.prepare('UPDATE skus SET sku=?,variant_label=?,price_pence=? WHERE id=? AND product_id=?').bind(v.sku,v.variant_label,v.price_pence,s.id,id))
        }
        statements.push(weightStatement(env.DB,s.id,s.weights),...optionImageStatements(env.DB,s.id,s.image))
      } else {
        statements.push(env.DB.prepare('INSERT INTO skus(sku,product_id,variant_label,price_pence,track_mode,quantity,in_stock) VALUES(?,?,?,?,?,?,?)').bind(v.sku,id,v.variant_label,v.price_pence,v.track_mode,v.quantity,v.in_stock),weightStatement(env.DB,null,s.weights))
        const imageId=parseImageId(s.image)
        if(imageId) statements.push(env.DB.prepare('INSERT INTO sku_images(sku_id,image_id) VALUES(last_insert_rowid(),?)').bind(imageId))
      }
    }
    for (const row of removed) statements.push(env.DB.prepare('DELETE FROM skus WHERE id=? AND product_id=?').bind(row.id,id))
    statements.push(auditStmt(env.DB,actor,body.id?'product.save':'product.create','product',id,{request_id:body.requestId,options:validated.length}))
    try { await env.DB.batch(statements) } catch(e) {
      // A concurrent retry may have committed while this request was validating.
      const raced=await replay();if(raced)return raced
      if (/NOT NULL constraint failed: admin_save_requests.result_json/.test(e.message)) return apiError('Stock changed during this save. Reload the product before changing its stock.',409)
      throw e
    }
    return json(result,body.id?200:201)
  } catch(e) { return apiError(`Could not save product: ${e.message}`,500,{code:'server_error'}) }
}
