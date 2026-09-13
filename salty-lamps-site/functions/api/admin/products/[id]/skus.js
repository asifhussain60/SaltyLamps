import { weightStatement } from '../../../../lib/postage-store.mjs'
import { validateWeights } from '../../../../lib/weights.mjs'
// POST /api/admin/products/:id/skus — add a SKU / variant to a product.
import { json, apiError, validationError, readJson, auditStmt } from '../../../../lib/admin-helpers.mjs'
import { validateSku } from '../../../../lib/validation.mjs'
import { checkOptionImage, parseImageId } from '../../../../lib/option-images.mjs'

export async function onRequestPost({ params, request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const { ok, errors, value } = validateSku(body)
  if (!ok) return validationError(errors)
  try { Object.assign(value,validateWeights(body)) } catch(e) { return apiError(e.message,400) }

  try {
    const product = await env.DB.prepare(`SELECT id FROM products WHERE id = ?`).bind(params.id).first()
    if (!product) return apiError('Product not found.', 404, { code: 'not_found' })
    const imageError = await checkOptionImage(env.DB, params.id, body.image_id)
    if (imageError) return imageError
    const imageId = parseImageId(body.image_id)

    const statements = [env.DB.prepare(
      `INSERT INTO skus (sku, product_id, variant_label, price_pence, track_mode, quantity, in_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(value.sku, params.id, value.variant_label, value.price_pence, value.track_mode, value.quantity, value.in_stock), weightStatement(env.DB,null,value)]
    if (imageId) statements.push(env.DB.prepare('INSERT INTO sku_images (sku_id, image_id) VALUES (last_insert_rowid(), ?)').bind(imageId))
    const [res] = await env.DB.batch(statements)

    const skuId = res.meta?.last_row_id
    await env.DB.batch([auditStmt(env.DB, data.actorEmail, 'sku.create', 'sku', skuId, { product_id: params.id, sku: value.sku })])
    return json({ id: skuId }, 201)
  } catch (err) {
    return apiError(`Could not add SKU: ${err.message}`, 500, { code: 'server_error' })
  }
}
