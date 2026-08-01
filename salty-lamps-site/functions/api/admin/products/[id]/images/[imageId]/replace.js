// POST /api/admin/products/:id/images/:imageId/replace — swap the file behind an
// existing gallery slot in place (keeps its position/id; only the R2 object changes).
import { json, apiError, auditStmt } from '../../../../../../lib/admin-helpers.mjs'
import { readUploadedImage, putImageObject, deleteImageObject, syncPrimaryImageStmt, currentPrimaryPath } from '../../../../../../lib/image-upload.mjs'

export async function onRequestPost({ params, request, env, data }) {
  if (!env.IMAGES) return apiError('Image storage is not configured.', 503, { code: 'no_storage' })

  const [upload, uploadErr] = await readUploadedImage(request)
  if (uploadErr) return uploadErr

  try {
    const row = await env.DB.prepare(
      `SELECT id, key FROM product_images WHERE id = ? AND product_id = ?`,
    ).bind(params.imageId, params.id).first()
    if (!row) return apiError('Image not found.', 404, { code: 'not_found' })

    const { key, path } = await putImageObject(env, params.id, upload)

    await env.DB.prepare(`UPDATE product_images SET key = ?, path = ? WHERE id = ?`).bind(key, path, row.id).run()

    // Recompute AFTER the row update so a replace of the primary image is reflected.
    const finalPrimaryPath = await currentPrimaryPath(env.DB, params.id)
    await env.DB.batch([
      syncPrimaryImageStmt(env.DB, params.id, finalPrimaryPath),
      auditStmt(env.DB, data.actorEmail, 'image.replace', 'product', params.id, { imageId: row.id }),
    ])

    await deleteImageObject(env, row.key)

    return json({ id: row.id, path, primary_path: finalPrimaryPath })
  } catch (err) {
    return apiError(`Could not replace image: ${err.message}`, 500, { code: 'server_error' })
  }
}
