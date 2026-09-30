// GET /api/admin/shop-copy — the shop's standard wording per product type, plus the
// category list that decides a product's type. The product editor shows this as the
// starting text of "Product Description".
//
// It lives under /api/admin/ on purpose: the admin hostname refuses every public
// /api/* route (see functions/_middleware.js), so the editor cannot borrow
// /api/content or /api/categories the way the shop does.
import { json, apiError } from '../../lib/admin-helpers.mjs'

export async function onRequestGet({ env }) {
  try {
    const [themes, categories, aliases] = await env.DB.batch([
      env.DB.prepare('SELECT theme, lede_template FROM content_themes'),
      // Same rows and filter as the public /api/categories, so the editor and the shop
      // agree on which type a product belongs to.
      env.DB.prepare(
        `SELECT slug, name, description, image, theme, sort_order, is_virtual
         FROM categories WHERE visible = 1 ORDER BY sort_order, name`,
      ),
      env.DB.prepare('SELECT alias, slug FROM category_aliases'),
    ])
    return json({
      themes: Object.fromEntries((themes.results || []).map(row => [row.theme, row.lede_template || ''])),
      categories: categories.results || [],
      aliases: Object.fromEntries((aliases.results || []).map(r => [r.alias, r.slug])),
    })
  } catch (err) {
    return apiError(`Could not load the standard wording: ${err.message}`, 500, { code: 'server_error' })
  }
}
