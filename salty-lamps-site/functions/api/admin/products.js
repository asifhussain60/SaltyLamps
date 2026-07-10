// GET  /api/admin/products — every product (incl. hidden) with its SKUs nested.
// POST /api/admin/products — create a product plus at least one SKU.
import { json, apiError, validationError, readJson, auditStmt } from '../../lib/admin-helpers.mjs'
import { validateProduct, validateSku } from '../../lib/validation.mjs'

export async function onRequestGet({ env }) {
  try {
    const [products, skus] = await env.DB.batch([
      env.DB.prepare(`SELECT * FROM products ORDER BY name`),
      env.DB.prepare(`SELECT * FROM skus ORDER BY product_id, id`),
    ])
    const byProduct = new Map()
    for (const s of skus.results || []) {
      if (!byProduct.has(s.product_id)) byProduct.set(s.product_id, [])
      byProduct.get(s.product_id).push(s)
    }
    const rows = (products.results || []).map(p => ({ ...p, skus: byProduct.get(p.id) || [] }))
    return json({ products: rows })
  } catch (err) {
    return apiError(`Could not load products: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestPost({ request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const product = validateProduct(body.product || {})
  if (!product.ok) return validationError(product.errors)

  const skuInputs = Array.isArray(body.skus) ? body.skus : []
  if (skuInputs.length === 0) return apiError('A product needs at least one SKU.', 400, { code: 'validation' })

  const skuValues = []
  for (let i = 0; i < skuInputs.length; i++) {
    const res = validateSku(skuInputs[i])
    if (!res.ok) return validationError(res.errors, `Fix SKU ${i + 1}.`)
    skuValues.push(res.value)
  }

  const id = `product_${crypto.randomUUID()}`
  const p = product.value

  try {
    const stmts = [
      env.DB.prepare(
        `INSERT INTO products (id, name, slug, description, image, categories, tags, visible)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, p.name, p.slug, p.description, p.image, p.categories, p.tags, p.visible),
      ...skuValues.map(s =>
        env.DB.prepare(
          `INSERT INTO skus (sku, product_id, variant_label, price_pence, track_mode, quantity, in_stock)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(s.sku, id, s.variant_label, s.price_pence, s.track_mode, s.quantity, s.in_stock),
      ),
      auditStmt(env.DB, data.actorEmail, 'product.create', 'product', id, { name: p.name, skus: skuValues.length }),
    ]
    await env.DB.batch(stmts)
    return json({ id }, 201)
  } catch (err) {
    return apiError(`Could not create product: ${err.message}`, 500, { code: 'server_error' })
  }
}
