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

// Gallery images, fetched SEPARATELY and stitched in JS — never JOINed into
// PRODUCTS_QUERY above.
//
// PRODUCTS_QUERY already fans out one row per SKU, so adding images to it would
// multiply SKUs by images: the 5-variant platter with 4 photos becomes 20 rows for
// one product. That silently duplicates every prerendered product route and every
// <url> entry in the product and image sitemaps — a failure that looks like
// success until someone counts the sitemap.
export const PRODUCT_IMAGES_QUERY = `
  SELECT pi.product_id, pi.path
  FROM product_images pi
  JOIN products p ON p.id = pi.product_id
  WHERE p.visible = 1
  ORDER BY pi.product_id, pi.sort_order, pi.id
`

// imageRows defaults to [] on purpose: scripts/fetch-content-snapshot.mjs and any
// other caller that only needs the flat cards can still call this with one argument.
export function flattenProductRows(rows, imageRows = []) {
  const imagesByProduct = new Map()
  for (const row of imageRows) {
    if (!imagesByProduct.has(row.product_id)) imagesByProduct.set(row.product_id, [])
    imagesByProduct.get(row.product_id).push(row.path)
  }

  return rows.map(row => {
    const hasVariant = row.variant_label && row.variant_label.length > 0
    const variantSlug = hasVariant ? row.variant_label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
    const inStock = row.track_mode === 'binary' ? row.in_stock === 1 : (row.quantity ?? 0) > 0

    return {
      id: `sku-${row.sku_id}`,
      skuId: row.sku_id,
      productId: row.product_id,
      slug: hasVariant ? `${row.slug}-${variantSlug}` : row.slug,
      name: hasVariant ? `${row.name} — ${row.variant_label}` : row.name,
      sku: row.sku,
      price: row.price_pence / 100,
      stock: inStock,
      // How many can actually be ordered. The cart uses this to cap quantity, so a
      // shopper finds out before checkout instead of hitting a 409 at the highest-
      // intent click. null for binary SKUs, which have no count by definition.
      //
      // Capped at 20 rather than published raw: the exact stock level of every line
      // is competitor-useful information, and "only 3 left" needs no more precision
      // than this. checkout.js remains the authority — this is an affordance, not a
      // guarantee, since the 60s cache can always be a little stale.
      stockQty: row.track_mode === 'quantity' ? Math.min(row.quantity ?? 0, 20) : null,
      trackMode: row.track_mode,
      categories: row.categories ? row.categories.split(',').filter(Boolean) : [],
      image: row.image,
      // The full gallery, primary first. Variants of one product share it, which is
      // correct — the photos are of the product, not the size.
      images: imagesByProduct.get(row.product_id) || (row.image ? [row.image] : []),
      description: row.description,
      tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    }
  })
}
