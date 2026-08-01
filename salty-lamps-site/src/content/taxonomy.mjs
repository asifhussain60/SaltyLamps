// The category taxonomy as a value, not a module-level const.
//
// WHY A FACTORY. Categories now come from D1 (GET /api/categories), but the helpers
// that read them — categoryName, themeForProduct, primaryCategory, categoryHref and
// friends — were module-scope functions closing over a hardcoded array. Making them
// depend on fetched state needs the taxonomy passed in explicitly.
//
// The alternative considered and rejected was a module-level mutable registry set on
// fetch: no signature churn, but a hidden global whose correctness depends on setState
// ordering, and which breaks under concurrent rendering. An explicit value is duller
// and always right.
//
// MUST stay pure: no React, no DOM, no Worker APIs. Imported by the storefront and
// available to the build.

const DEFAULT_THEME = 'lamp'
const FALLBACK_BUCKET = 'all-products'

export function makeTaxonomy(categoryRows = [], aliases = {}) {
  const list = [...categoryRows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const bySlug = new Map(list.map(c => [c.slug, c]))

  // Categories a shopper can actually browse to: everything except the catch-all
  // bucket. This replaces `filter(c => c.slug !== 'all-products')`, which was
  // repeated in the sidebar, the mobile jump nav, the spotlight rail and the
  // sitemap generator — four places that had to agree by hand.
  const navList = list.filter(c => !c.is_virtual)

  // An old slug that must keep resolving, e.g. the 'himalyan-' typo.
  const resolve = slug => aliases[slug] || slug

  const get = slug => bySlug.get(resolve(slug))

  // A product's headline category — the first that isn't the catch-all bucket.
  // Driven by is_virtual rather than a hardcoded 'all-products' literal, so adding
  // another bucket later needs no code change.
  const primaryCategoryOf = product => {
    const slugs = product?.categories || []
    return slugs.find(slug => !bySlug.get(slug)?.is_virtual) || slugs[0] || FALLBACK_BUCKET
  }

  return {
    list,
    navList,
    isEmpty: list.length === 0,
    resolve,
    get,
    has: slug => bySlug.has(resolve(slug)),
    // Falls back to a readable title rather than the old 'All products', which
    // mislabelled every product in an unknown category.
    nameOf: slug => get(slug)?.name || titleize(slug),
    descriptionOf: slug => get(slug)?.description || '',
    imageOf: slug => get(slug)?.image || '',
    themeOf: slug => get(slug)?.theme || DEFAULT_THEME,
    primaryCategoryOf,
    themeForProduct: product => get(primaryCategoryOf(product))?.theme || DEFAULT_THEME,
    href: slug => `/category/${resolve(slug)}`,
    collectionHref: (collectionSlug, categorySlug) =>
      `/collection/${collectionSlug}/${resolve(categorySlug)}`,
  }
}

export function titleize(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}
