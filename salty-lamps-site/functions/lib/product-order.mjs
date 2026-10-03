// Shared by the public feed, build snapshot and admin preview. A settings record
// keeps this additive feature independent of product edits and schema migrations.
export const PRODUCT_ORDER_KEY = 'product_display_order'
export const PRODUCT_ORDER_JOIN = `LEFT JOIN json_each(
  COALESCE((SELECT json_extract(value, '$.productIds') FROM settings WHERE key='${PRODUCT_ORDER_KEY}'), '[]')
) display_order ON display_order.value = p.id`
export const PRODUCT_ORDER_BY = 'COALESCE(display_order.key, 2147483647), p.name, p.id'
export const ADMIN_PRODUCT_ORDER_QUERY = `
  SELECT p.id, p.name, p.image, p.visible, p.categories,
         (SELECT COUNT(*) FROM skus WHERE product_id=p.id) AS option_count
  FROM products p ${PRODUCT_ORDER_JOIN}
  ORDER BY ${PRODUCT_ORDER_BY}
`
