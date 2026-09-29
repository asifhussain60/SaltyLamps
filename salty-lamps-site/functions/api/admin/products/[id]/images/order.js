// Persist the complete gallery order; its first image is the shop cover.
import { json, apiError, auditStmt } from '../../../../../lib/admin-helpers.mjs'

export async function onRequestPut({ params, request, env, data }) {
  try {
    const body = await request.json()
    const ids = body?.imageIds
    if (!Array.isArray(ids) || ids.length < 1 || ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
      return apiError('Send each gallery image once in its new order.', 400)
    }
    const product = await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(params.id).first()
    if (!product) return apiError('Product not found.', 404, { code: 'not_found' })
    const { results: current } = await env.DB.prepare('SELECT id,path FROM product_images WHERE product_id=? ORDER BY sort_order,id').bind(params.id).all()
    if (current.length !== ids.length || ids.some(id => !current.some(image => image.id === id))) {
      return apiError('The gallery changed. Refresh it before reordering.', 409, { code: 'gallery_changed' })
    }
    await env.DB.batch([
      ...ids.map((id, index) => env.DB.prepare('UPDATE product_images SET sort_order=? WHERE id=? AND product_id=?').bind(index, id, params.id)),
      env.DB.prepare('UPDATE products SET image=(SELECT path FROM product_images WHERE product_id=? ORDER BY sort_order,id LIMIT 1) WHERE id=?').bind(params.id, params.id),
      auditStmt(env.DB, data.actorEmail, 'image.reorder', 'product', params.id, { imageIds: ids }),
    ])
    const { results: images } = await env.DB.prepare('SELECT id,path FROM product_images WHERE product_id=? ORDER BY sort_order,id').bind(params.id).all()
    return json({ images, primary_path: images[0]?.path || '' })
  } catch (error) {
    if (error instanceof SyntaxError) return apiError('Invalid gallery order.', 400)
    return apiError(`Could not reorder images: ${error.message}`, 500, { code: 'server_error' })
  }
}
