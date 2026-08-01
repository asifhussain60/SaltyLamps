// DELETE /api/admin/products/:id/images/:imageId — remove one gallery image.
// If it was the primary (lowest sort_order), the next remaining image is promoted;
// if none remain, the product's cover image is cleared.
import { json, apiError, auditStmt } from '../../../../../lib/admin-helpers.mjs'
import { deleteImageObject, syncPrimaryImageStmt, currentPrimaryPath } from '../../../../../lib/image-upload.mjs'

export async function onRequestDelete({ params, env, data }) {
  try {
    const row = await env.DB.prepare(
      `SELECT id, key FROM product_images WHERE id = ? AND product_id = ?`,
    ).bind(params.imageId, params.id).first()
    if (!row) return apiError('Image not found.', 404, { code: 'not_found' })

    await env.DB.prepare(`DELETE FROM product_images WHERE id = ?`).bind(row.id).run()
    await deleteImageObject(env, row.key)

    const primaryPath = await currentPrimaryPath(env.DB, params.id)
    await env.DB.batch([
      syncPrimaryImageStmt(env.DB, params.id, primaryPath),
      auditStmt(env.DB, data.actorEmail, 'image.delete', 'product', params.id, { imageId: row.id }),
    ])

    return json({ id: row.id, deleted: true, primary_path: primaryPath })
  } catch (err) {
    return apiError(`Could not delete image: ${err.message}`, 500, { code: 'server_error' })
  }
}
