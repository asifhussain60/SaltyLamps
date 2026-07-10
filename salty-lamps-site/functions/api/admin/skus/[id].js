// PATCH  /api/admin/skus/:id — update a SKU / variant.
// DELETE /api/admin/skus/:id — delete, but only when no order references it.
import { json, apiError, validationError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'
import { validateSku } from '../../../lib/validation.mjs'

export async function onRequestPatch({ params, request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const skuId = Number(params.id)
  if (!Number.isInteger(skuId)) return apiError('Invalid SKU id.', 400)

  const { ok, errors, value } = validateSku(body)
  if (!ok) return validationError(errors)

  try {
    const existing = await env.DB.prepare(`SELECT id FROM skus WHERE id = ?`).bind(skuId).first()
    if (!existing) return apiError('SKU not found.', 404, { code: 'not_found' })

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE skus SET sku=?, variant_label=?, price_pence=?, track_mode=?, quantity=?, in_stock=? WHERE id=?`,
      ).bind(value.sku, value.variant_label, value.price_pence, value.track_mode, value.quantity, value.in_stock, skuId),
      auditStmt(env.DB, data.actorEmail, 'sku.update', 'sku', skuId, value),
    ])
    return json({ id: skuId })
  } catch (err) {
    return apiError(`Could not update SKU: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestDelete({ params, env, data }) {
  const skuId = Number(params.id)
  if (!Number.isInteger(skuId)) return apiError('Invalid SKU id.', 400)

  try {
    const existing = await env.DB.prepare(`SELECT id FROM skus WHERE id = ?`).bind(skuId).first()
    if (!existing) return apiError('SKU not found.', 404, { code: 'not_found' })

    const ref = await env.DB.prepare(`SELECT COUNT(*) c FROM order_items WHERE sku_id = ?`).bind(skuId).first()
    if ((ref?.c || 0) > 0) {
      return apiError(
        'This SKU appears on past orders and cannot be deleted. Set it out of stock instead.',
        409,
        { code: 'referenced' },
      )
    }

    // Don't strand a product with zero SKUs — block deleting the last one.
    const productId = (await env.DB.prepare(`SELECT product_id FROM skus WHERE id = ?`).bind(skuId).first())?.product_id
    const siblings = await env.DB.prepare(`SELECT COUNT(*) c FROM skus WHERE product_id = ?`).bind(productId).first()
    if ((siblings?.c || 0) <= 1) {
      return apiError('A product must keep at least one SKU. Delete the product instead.', 409, { code: 'last_sku' })
    }

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM skus WHERE id = ?`).bind(skuId),
      auditStmt(env.DB, data.actorEmail, 'sku.delete', 'sku', skuId, null),
    ])
    return json({ id: skuId, deleted: true })
  } catch (err) {
    return apiError(`Could not delete SKU: ${err.message}`, 500, { code: 'server_error' })
  }
}
