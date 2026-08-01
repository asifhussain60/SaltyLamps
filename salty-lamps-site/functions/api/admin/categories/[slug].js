// PATCH  /api/admin/categories/:slug — update display metadata.
// DELETE /api/admin/categories/:slug — delete, but only when no product references it.
import { json, apiError, validationError, readJson, auditStmt } from '../../../lib/admin-helpers.mjs'
import { validateCategory } from '../../../lib/validation.mjs'

export async function onRequestPatch({ params, request, env, data }) {
  const [body, bodyErr] = await readJson(request)
  if (bodyErr) return bodyErr

  // isNew is false, so the slug is not settable. It is the primary key AND the public
  // URL AND the string products reference, so renaming needs a data migration across
  // products.categories — the admin offers hide rather than a silent half-rename.
  const { ok, errors, value } = validateCategory(body)
  if (!ok) return validationError(errors)

  try {
    const existing = await env.DB.prepare(`SELECT slug, is_virtual FROM categories WHERE slug = ?`)
      .bind(params.slug).first()
    if (!existing) return apiError('Category not found.', 404, { code: 'not_found' })
    if (existing.is_virtual && value.visible === 0) {
      return validationError({ visible: 'The all-products bucket cannot be hidden.' })
    }

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE categories SET name=?, description=?, image=?, theme=?, sort_order=?, visible=?,
                               updated_at=datetime('now')
         WHERE slug=?`,
      ).bind(value.name, value.description, value.image, value.theme, value.sort_order, value.visible, params.slug),
      auditStmt(env.DB, data.actorEmail, 'category.update', 'category', params.slug, value),
    ])
    return json({ slug: params.slug })
  } catch (err) {
    return apiError(`Could not update category: ${err.message}`, 500, { code: 'server_error' })
  }
}

export async function onRequestDelete({ params, env, data }) {
  try {
    const category = await env.DB.prepare(`SELECT slug, is_virtual FROM categories WHERE slug = ?`)
      .bind(params.slug).first()
    if (!category) return apiError('Category not found.', 404, { code: 'not_found' })
    if (category.is_virtual) {
      return apiError('The all-products bucket cannot be deleted.', 409, { code: 'referenced' })
    }

    // D1 does not enforce foreign keys, so this guard is the only thing standing
    // between a delete and a set of products pointing at a category that no longer
    // exists. Same shape as the product delete guard.
    //
    // The commas either side make this an exact token match: without them,
    // deleting 'salt-lamps' would also match a product tagged 'salt-lamps-mini'.
    const referenced = await env.DB.prepare(
      `SELECT COUNT(*) c FROM products WHERE ',' || categories || ',' LIKE '%,' || ? || ',%'`,
    ).bind(params.slug).first()

    if (referenced?.c > 0) {
      return apiError(
        `${referenced.c} product${referenced.c === 1 ? '' : 's'} still use this category. `
        + 'Reassign them first, or hide the category instead of deleting it.',
        409,
        { code: 'referenced' },
      )
    }

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM category_aliases WHERE slug = ?`).bind(params.slug),
      env.DB.prepare(`DELETE FROM categories WHERE slug = ?`).bind(params.slug),
      auditStmt(env.DB, data.actorEmail, 'category.delete', 'category', params.slug, null),
    ])
    return json({ deleted: params.slug })
  } catch (err) {
    return apiError(`Could not delete category: ${err.message}`, 500, { code: 'server_error' })
  }
}
