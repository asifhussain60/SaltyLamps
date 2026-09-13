import { apiError } from './admin-helpers.mjs'

// undefined means an older client did not edit this field; null clears it.
export function parseImageId(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) return NaN
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : NaN
}

export async function checkOptionImage(db, productId, raw) {
  const id = parseImageId(raw)
  if (Number.isNaN(id)) return apiError('Choose a valid option photo.', 400, { code: 'validation' })
  if (id == null) return null
  const image = await db.prepare('SELECT id FROM product_images WHERE id = ? AND product_id = ?').bind(id, productId).first()
  return image ? null : apiError('Choose a photo from this product’s gallery.', 400, { code: 'validation' })
}

export function optionImageStatements(db, skuId, raw) {
  const id = parseImageId(raw)
  if (id === undefined) return []
  if (id === null) return [db.prepare('DELETE FROM sku_images WHERE sku_id = ?').bind(skuId)]
  return [db.prepare(`INSERT INTO sku_images (sku_id, image_id) VALUES (?, ?)
    ON CONFLICT(sku_id) DO UPDATE SET image_id = excluded.image_id`).bind(skuId, id)]
}
