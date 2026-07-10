// PATCH  /api/admin/products/:id — update product fields.
// DELETE /api/admin/products/:id — delete, but only when no order references its SKUs.
import { json, apiError, validationError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'
import { validateProduct } from '../../../lib/validation.mjs'

export async function onRequestPatch({ params, request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const { ok, errors, value } = validateProduct(body)
  if (!ok) return validationError(errors)

  try {
    const existing = await env.DB.prepare(`SELECT id FROM products WHERE id = ?`).bind(params.id).first()
    if (!existing) return apiError('Product not found.', 404, { code: 'not_found' })

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE products SET name=?, slug=?, description=?, image=?, categories=?, tags=?, visible=? WHERE id=?`,
      ).bind(value.name, value.slug, value.description, value.image, value.categories, value.tags, value.visible, params.id),
      auditStmt(env.DB, data.actorEmail, 'product.update', 'product', params.id, value),
    ])
    return json({ id: params.id })
  } catch (err) {
    return apiError(`Could not update product: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestDelete({ params, env, data }) {
  try {
    const existing = await env.DB.prepare(`SELECT id FROM products WHERE id = ?`).bind(params.id).first()
    if (!existing) return apiError('Product not found.', 404, { code: 'not_found' })

    // Guard: hard-deleting a product whose SKUs appear on past orders would orphan
    // order_items silently (D1 has no FK enforcement). Block and steer to hide.
    const ref = await env.DB.prepare(
      `SELECT COUNT(*) c FROM order_items oi JOIN skus s ON s.id = oi.sku_id WHERE s.product_id = ?`,
    ).bind(params.id).first()
    if ((ref?.c || 0) > 0) {
      return apiError(
        'This product appears on past orders and cannot be deleted. Hide it instead (set visibility off).',
        409,
        { code: 'referenced' },
      )
    }

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM skus WHERE product_id = ?`).bind(params.id),
      env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(params.id),
      auditStmt(env.DB, data.actorEmail, 'product.delete', 'product', params.id, null),
    ])
    return json({ id: params.id, deleted: true })
  } catch (err) {
    return apiError(`Could not delete product: ${err.message}`, 500, { code: 'server_error' })
  }
}
