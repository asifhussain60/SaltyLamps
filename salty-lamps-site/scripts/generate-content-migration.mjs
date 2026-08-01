// Generates the backfill INSERTs that carry hardcoded site content into D1,
// straight from src/content/site-content.mjs.
//
// WHY GENERATE RATHER THAN HAND-WRITE: the content is ~1,000 lines of nested JS
// literals full of apostrophes, em-dashes and curly quotes. Transcribing it by hand
// into SQL is exactly the kind of job where one missed escape ships a broken page.
// Importing the real module and serialising it means the SQL cannot disagree with
// what the site renders today.
//
// USAGE
//   node scripts/generate-content-migration.mjs categories   > d1/migrations/003-...sql
//
// Re-runnable and deterministic: same input, byte-identical output.

import {
  categories,
  categoryAliases,
  groupThemes,
  siteUrl,
} from '../src/content/site-content.mjs'

// Categories with no product assigned and no near-term plan to sell them start
// hidden rather than deleted, so switching them on later is a toggle in the admin
// rather than another migration. (Owner decision, 2026-08-01: the Aura Collection
// has zero products and no finalised pricing.)
const START_HIDDEN = new Set(['salt-wall-panels'])

// 'all-products' is the catch-all bucket, not a merchandising category. Flagging it
// in data replaces the `slug !== 'all-products'` literal that is currently repeated
// in the storefront nav, the spotlight rail and the sitemap generator.
const VIRTUAL = new Set(['all-products'])

// The theme drives which of the nine CSS custom-property sets a category renders
// with. 'all-products' has no groupThemes entry today and falls through to the
// 'lamp' default in themeForProduct — preserved here explicitly.
const DEFAULT_THEME = 'lamp'

const sql = v => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

const SETTINGS = [
  // Behavioural. Read by the inventory endpoints and the admin dashboard, each of
  // which falls back to the LOW_STOCK_THRESHOLD constant when the row is absent.
  ['low_stock_threshold', '5', 'int'],
  // Read-only in the admin: checkout, the storefront formatter and the admin
  // formatter all hardcode GBP and the Stripe account is GBP, so an editable field
  // here would change nothing and mislead.
  ['currency', 'GBP', 'string'],
  ['site_url', siteUrl, 'string'],
]

function categoriesMigration() {
  const out = []
  out.push(`-- Categories: the taxonomy that until now lived in src/App.jsx's \`categories\` const.
-- name/description/image carried verbatim; theme from the \`groupThemes\` map.
-- sort_order is spaced by ten so the owner can reorder without renumbering.`)

  categories.forEach((c, i) => {
    out.push(
      `INSERT OR IGNORE INTO categories (slug, name, description, image, theme, sort_order, visible, is_virtual)\n`
      + `  VALUES (${sql(c.slug)}, ${sql(c.name)}, ${sql(c.description)}, ${sql(c.image)}, `
      + `${sql(groupThemes[c.slug] || DEFAULT_THEME)}, ${VIRTUAL.has(c.slug) ? 0 : (i + 1) * 10}, `
      + `${START_HIDDEN.has(c.slug) ? 0 : 1}, ${VIRTUAL.has(c.slug) ? 1 : 0});`,
    )
  })

  out.push(`
-- Slug aliases. This 301 mapping previously existed in three places at once:
-- App.jsx's \`categoryAliases\`, generate-seo.mjs's legacy/clean slug pair, and
-- public/_redirects. The first two now read from here.`)
  for (const [alias, slug] of Object.entries(categoryAliases)) {
    out.push(`INSERT OR IGNORE INTO category_aliases (alias, slug) VALUES (${sql(alias)}, ${sql(slug)});`)
  }

  out.push(`
-- Settings. Only keys that something actually reads are seeded; an editable field
-- that changes nothing is worse than an honest static one.`)
  for (const [key, value, type] of SETTINGS) {
    out.push(
      `INSERT OR IGNORE INTO settings (key, value, value_type) VALUES (${sql(key)}, ${sql(value)}, ${sql(type)});`,
    )
  }

  return out.join('\n')
}

const target = process.argv[2] || 'categories'
if (target !== 'categories') {
  console.error(`Unknown target ${JSON.stringify(target)}. Known: categories`)
  process.exit(1)
}
console.log(categoriesMigration())
