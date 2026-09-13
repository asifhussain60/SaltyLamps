import {
  validateWeights,
  WEIGHT_FIELDS,
  DEFAULT_POSTAGE_CONFIG,
  validatePostageConfig,
} from './weights.mjs'
export const WEIGHT_SELECT =
  "w.product_weight_min_g, w.product_weight_max_g, w.packed_weight_g, COALESCE(w.postal_group,'') AS postal_group, COALESCE(w.weight_public,1) AS weight_public"
export function weightStatement(db, id, input, existing = {}) {
  const v = validateWeights(input, existing)
  const idSql = id === null ? 'last_insert_rowid()' : '?'
  return db
    .prepare(
      `INSERT INTO sku_weights (sku_id,${WEIGHT_FIELDS.join(',')}) VALUES (${idSql},?,?,?,?,?) ON CONFLICT(sku_id) DO UPDATE SET ${WEIGHT_FIELDS.map((k) => `${k}=excluded.${k}`).join(',')}`,
    )
    .bind(...(id === null ? [] : [id]), ...WEIGHT_FIELDS.map((k) => v[k]))
}
export async function readPostageConfig(db) {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key='postage_config'")
    .first()
  return row
    ? validatePostageConfig(JSON.parse(row.value))
    : { ...DEFAULT_POSTAGE_CONFIG, rates: [] }
}
export const hasWeightInput = (input) =>
  WEIGHT_FIELDS.some((k) => Object.hasOwn(input, k))
export async function orderWeightLines(db, id) {
  const { results } = await db
    .prepare(
      `SELECT oi.sku_id,oi.quantity, p.name,s.variant_label,
    ow.order_id AS snapshot_order_id,
    CASE WHEN ow.order_id IS NOT NULL THEN ow.packed_weight_g ELSE sw.packed_weight_g END packed_weight_g,
    CASE WHEN ow.order_id IS NOT NULL THEN ow.postal_group ELSE sw.postal_group END postal_group,
    CASE WHEN ow.order_id IS NOT NULL THEN ow.product_weight_min_g ELSE sw.product_weight_min_g END product_weight_min_g,
    CASE WHEN ow.order_id IS NOT NULL THEN ow.product_weight_max_g ELSE sw.product_weight_max_g END product_weight_max_g,
    CASE WHEN ow.order_id IS NOT NULL THEN ow.weight_public ELSE COALESCE(sw.weight_public,1) END weight_public
    FROM order_items oi JOIN skus s ON s.id=oi.sku_id JOIN products p ON p.id=s.product_id
    LEFT JOIN order_item_weights ow ON ow.order_id=oi.order_id AND ow.sku_id=oi.sku_id
    LEFT JOIN sku_weights sw ON sw.sku_id=oi.sku_id WHERE oi.order_id=?`,
    )
    .bind(id)
    .all()
  return results || []
}
