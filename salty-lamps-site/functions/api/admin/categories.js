// GET  /api/admin/categories — every category, including hidden ones, with a live
//                              product count so the admin can see what is empty.
// POST /api/admin/categories — create one.
import { json, apiError, validationError, readJson, auditStmt } from '../../lib/admin-helpers.mjs'
import { validateCategory } from '../../lib/validation.mjs'

export async function onRequestGet({ env }) {
  try {
    const [categories, products] = await env.DB.batch([
      env.DB.prepare(`SELECT * FROM categories ORDER BY sort_order, name`),
      // Membership is a comma-separated string, so the count is done in JS rather
      // than SQL. Cheap at this size, and it keeps the storage decision in one place.
      env.DB.prepare(`SELECT categories FROM products WHERE visible = 1`),
    ])

    const counts = new Map()
    for (const row of products.results || []) {
      for (const slug of String(row.categories || '').split(',').filter(Boolean)) {
        counts.set(slug, (counts.get(slug) || 0) + 1)
      }
    }

    return json({
      categories: (categories.results || []).map(c => ({ ...c, product_count: counts.get(c.slug) || 0 })),
    })
  } catch (err) {
    return apiError(`Could not load categories: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestPost({ request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  const { ok, errors, value } = validateCategory(body, { isNew: true })
  if (!ok) return validationError(errors)

  try {
    const existing = await env.DB.prepare(`SELECT slug FROM categories WHERE slug = ?`).bind(value.slug).first()
    if (existing) return validationError({ slug: 'That slug is already in use.' })

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO categories (slug, name, description, image, theme, sort_order, visible)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(value.slug, value.name, value.description, value.image, value.theme, value.sort_order, value.visible),
      auditStmt(env.DB, data.actorEmail, 'category.create', 'category', value.slug, value),
    ])
    return json({ slug: value.slug }, 201)
  } catch (err) {
    return apiError(`Could not create category: ${err.message}`, 500, { code: 'server_error' })
  }
}
