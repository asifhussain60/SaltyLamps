// Protected by /api/admin middleware; there is no public write route.
import { json, apiError, readJson } from '../../../lib/admin-helpers.mjs'
import { ADMIN_PRODUCT_ORDER_QUERY, PRODUCT_ORDER_KEY } from '../../../lib/product-order.mjs'

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const conflict = () => apiError('The product list or saved order has changed. Reload the saved order before trying again.', 409, { code: 'order_changed' })

export async function onRequestGet({ env }) {
  try {
    const [products, settings] = await env.DB.batch([
      env.DB.prepare(ADMIN_PRODUCT_ORDER_QUERY),
      env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(PRODUCT_ORDER_KEY),
    ])
    const saved = JSON.parse(settings.results?.[0]?.value || '{}')
    return json({ products: products.results || [], revision: saved.revision || '' })
  } catch {
    return apiError('Could not load the shop order. Please try again.', 500)
  }
}

export async function onRequestPut({ request, env, data }) {
  const [body, error] = await readJson(request)
  if (error) return error
  const { productIds, revision, requestId } = body || {}
  if (!Array.isArray(productIds) || productIds.length > 10000
    || productIds.some(id => typeof id !== 'string' || !id.length || id.length > 200)
    || new Set(productIds).size !== productIds.length
    || typeof revision !== 'string' || (revision !== '' && !uuid.test(revision))
    || typeof requestId !== 'string' || !uuid.test(requestId) || requestId === revision) {
    return apiError('Send every product once, together with the saved order version.', 400)
  }
  const ids = JSON.stringify(productIds)
  const value = JSON.stringify({ revision: requestId, productIds })
  try {
    // Membership and revision are checked inside the write, closing the race
    // between two administrators that a separate read-then-write check would leave.
    const [saved] = await env.DB.batch([
      env.DB.prepare(`INSERT INTO settings (key,value,value_type)
        SELECT ?,?,'json'
        WHERE COALESCE((SELECT json_extract(value,'$.revision') FROM settings WHERE key=?),'')=?
          AND (SELECT COUNT(*) FROM products)=json_array_length(?)
          AND NOT EXISTS (SELECT 1 FROM json_each(?) incoming
                          WHERE NOT EXISTS (SELECT 1 FROM products WHERE id=incoming.value))
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`)
        .bind(PRODUCT_ORDER_KEY, value, PRODUCT_ORDER_KEY, revision, ids, ids),
      env.DB.prepare(`INSERT INTO admin_audit(actor_email,action,entity,entity_id,detail)
        SELECT ?,'product.reorder','settings',?,? WHERE changes()=1`)
        .bind(data.actorEmail || 'unknown', PRODUCT_ORDER_KEY, value),
    ])
    if (saved.meta.changes !== 1) {
      // Retrying a lost response does not write twice or duplicate the audit log.
      const current = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(PRODUCT_ORDER_KEY).first()
      if (current?.value !== value) return conflict()
    }
    return json({ revision: requestId })
  } catch {
    return apiError('Could not save the shop order. Your draft is still available; please try again.', 500)
  }
}
