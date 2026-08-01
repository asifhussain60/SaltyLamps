// POST /api/admin/products/:id/images — add a new image to the product's gallery.
// The first image ever added becomes the primary (products.image, shown on product
// cards and the storefront); later images just extend the gallery.
import { json, apiError, auditStmt } from '../../../../lib/admin-helpers.mjs'
import { readUploadedImage, putImageObject, syncPrimaryImageStmt, currentPrimaryPath } from '../../../../lib/image-upload.mjs'

export async function onRequestPost({ params, request, env, data }) {
  if (!env.IMAGES) return apiError('Image storage is not configured.', 503, { code: 'no_storage' })

  const [upload, uploadErr] = await readUploadedImage(request)
  if (uploadErr) return uploadErr

  try {
    const product = await env.DB.prepare(`SELECT id FROM products WHERE id = ?`).bind(params.id).first()
    if (!product) return apiError('Product not found.', 404, { code: 'not_found' })

    const { key, path } = await putImageObject(env, params.id, upload)

    const maxOrder = await env.DB.prepare(
      `SELECT COALESCE(MAX(sort_order), -1) m FROM product_images WHERE product_id = ?`,
    ).bind(params.id).first()
    const sortOrder = (maxOrder?.m ?? -1) + 1

    const inserted = await env.DB.prepare(
      `INSERT INTO product_images (product_id, key, path, sort_order) VALUES (?, ?, ?, ?)`,
    ).bind(params.id, key, path, sortOrder).run()
    const imageId = inserted.meta?.last_row_id

    const primaryPath = await currentPrimaryPath(env.DB, params.id)
    await env.DB.batch([
      syncPrimaryImageStmt(env.DB, params.id, primaryPath),
      auditStmt(env.DB, data.actorEmail, 'image.add', 'product', params.id, { imageId, key }),
    ])

    return json({ id: imageId, path, sort_order: sortOrder, primary_path: primaryPath }, 201)
  } catch (err) {
    return apiError(`Could not upload image: ${err.message}`, 500, { code: 'server_error' })
  }
}
