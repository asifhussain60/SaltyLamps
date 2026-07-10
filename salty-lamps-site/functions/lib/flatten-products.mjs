// Shared by functions/api/products.js (Worker runtime) and scripts/generate-seo.mjs
// (Node build script) — both need the exact same products+skus -> flat product
// list transform, just fetched via different D1 access paths.

export const PRODUCTS_QUERY = `
  SELECT p.id AS product_id, p.name, p.slug, p.description, p.image, p.categories, p.tags,
         s.id AS sku_id, s.sku, s.variant_label, s.price_pence, s.track_mode, s.quantity, s.in_stock
  FROM products p
  JOIN skus s ON s.product_id = p.id
  WHERE p.visible = 1
  ORDER BY p.name, s.id
`

export function flattenProductRows(rows) {
  return rows.map(row => {
    const hasVariant = row.variant_label && row.variant_label.length > 0
    const variantSlug = hasVariant ? row.variant_label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
    const inStock = row.track_mode === 'binary' ? row.in_stock === 1 : (row.quantity ?? 0) > 0

    return {
      id: `sku-${row.sku_id}`,
      skuId: row.sku_id,
      slug: hasVariant ? `${row.slug}-${variantSlug}` : row.slug,
      name: hasVariant ? `${row.name} — ${row.variant_label}` : row.name,
      sku: row.sku,
      price: row.price_pence / 100,
      stock: inStock,
      categories: row.categories ? row.categories.split(',').filter(Boolean) : [],
      image: row.image,
      description: row.description,
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    }
  })
}
