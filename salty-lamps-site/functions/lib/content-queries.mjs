// The content layer's SQL and its response shape, in one place.
//
// WHY SHARED. Three different runtimes have to read this content and agree exactly:
//
//   • the Worker            — functions/api/content.js, via env.DB.batch
//   • the build snapshot    — scripts/fetch-content-snapshot.mjs, via the D1 HTTP API
//   • the SEO generator     — scripts/generate-seo.mjs, via the snapshot
//
// When the queries lived inside the endpoint, the build had no way to read the same
// data without reimplementing them, and a reimplementation is a copy that drifts.
// This is the same share pattern as flatten-products.mjs and validation.mjs.
//
// MUST stay pure: no env, no fetch, no React. Just query text and a shaping function.

// The address the shop publishes as its own — its Contact links, the "Ask a question"
// button, the footer, and the schema.org Store block. It is the SAME setting the admin
// notifications are sent to (admin_notify_email), so changing it in admin Settings
// moves both together instead of leaving the website pointing at an old mailbox.
//
// The fallback is what the site published before this was wired up. It matters because
// /api/content is allowed to fail without blanking the shop: a fetch failure must
// degrade to a working mailto, never to `mailto:` with nothing after it.
export const DEFAULT_CONTACT_EMAIL = 'info@saltylamps.co.uk'

export const CONTENT_QUERY_KEYS = [
  'collections', 'collectionCategories', 'sections', 'themes',
  'themeImages', 'pages', 'snippets', 'listItems', 'featured', 'reviewCount',
  'contact',
]

// Order matches CONTENT_QUERY_KEYS. Both the batch and the HTTP API return result
// sets positionally, so the two must not drift apart.
export const CONTENT_QUERIES = [
  `SELECT * FROM collections WHERE visible = 1 ORDER BY sort_order, name`,
  `SELECT collection_slug, category_slug FROM collection_categories ORDER BY collection_slug, sort_order`,
  `SELECT * FROM collection_sections ORDER BY collection_slug, sort_order`,
  `SELECT * FROM content_themes`,
  `SELECT theme, src, alt FROM theme_images ORDER BY theme, sort_order`,
  `SELECT path, title, body, meta_description FROM content_pages`,
  `SELECT key, value FROM content_snippets`,
  `SELECT list_key, label, title, text, href, metric_value, metric_percent FROM content_list_items ORDER BY list_key, sort_order`,
  // display = 1 is the ASA filter, enforced in SQL so a suppressed quote never
  // reaches a browser at all.
  `SELECT id, name, date_text, quote, proof, rating FROM reviews WHERE featured = 1 AND display = 1 ORDER BY featured_order`,
  // The home page states how many guestbook notes back the review band, but it must
  // not pull the whole corpus to do it. Counting server-side also makes the figure
  // honest: it is the number actually displayable, not the raw archive size that the
  // old copy quoted while silently filtering ten of them out.
  `SELECT COUNT(*) AS n FROM reviews WHERE display = 1 AND featured = 0`,
  // ONE KEY BY NAME, never `SELECT * FROM settings`. This result set is served to the
  // public by /api/content, and the settings table also holds the sender address and
  // the operational switches — none of which a visitor has any business reading.
  `SELECT value FROM settings WHERE key = 'admin_notify_email'`,
]

export const CATEGORIES_QUERY =
  `SELECT slug, name, description, image, theme, sort_order, is_virtual FROM categories WHERE visible = 1 ORDER BY sort_order, name`
export const CATEGORY_ALIASES_QUERY = `SELECT alias, slug FROM category_aliases`

const parseJson = (raw, fallback) => {
  try {
    const v = JSON.parse(raw)
    return v ?? fallback
  } catch {
    // A malformed JSON column must not take a page down. Falling back to the empty
    // shape degrades to "this bit of copy is missing", never a blank screen.
    return fallback
  }
}

const groupBy = (rows, key, make) => {
  const out = new Map()
  for (const row of rows || []) {
    if (!out.has(row[key])) out.set(row[key], [])
    out.get(row[key]).push(make(row))
  }
  return out
}

/**
 * Turn the raw result sets into the /api/content payload.
 * `sets` is keyed by CONTENT_QUERY_KEYS; each value is a plain array of rows.
 */
export function shapeContent(sets) {
  const categoriesByCollection = groupBy(sets.collectionCategories, 'collection_slug', r => r.category_slug)
  const sectionsByCollection = groupBy(sets.sections, 'collection_slug', r => ({ ...r, rule: parseJson(r.rule, {}) }))
  const imagesByTheme = groupBy(sets.themeImages, 'theme', r => ({ src: r.src, alt: r.alt }))

  const lists = {}
  for (const row of sets.listItems || []) {
    ;(lists[row.list_key] ||= []).push({
      label: row.label, title: row.title, text: row.text, href: row.href,
      // Only the review-signals list sets these; everything else gets nulls it ignores.
      count: row.metric_value ?? null,
      percent: row.metric_percent ?? null,
    })
  }

  return {
    collections: (sets.collections || []).map(row => ({
      slug: row.slug,
      name: row.name,
      shortName: row.short_name,
      eyebrow: row.eyebrow,
      heading: row.heading,
      description: row.description,
      heroIntro: parseJson(row.hero_intro, []),
      heroVideo: row.hero_video,
      heroPoster: row.hero_poster,
      theme: row.theme,
      background: row.background,
      categories: categoriesByCollection.get(row.slug) || [],
      sections: sectionsByCollection.get(row.slug) || [],
      // Absent trade copy renders nothing, exactly as the old `|| null` did.
      trade: row.trade_heading
        ? { eyebrow: row.trade_eyebrow, heading: row.trade_heading, body: row.trade_body, cta: row.trade_cta }
        : null,
    })),
    themes: Object.fromEntries(
      (sets.themes || []).map(row => [
        row.theme,
        {
          lede: row.lede_template,
          useTitle: row.use_title,
          uses: parseJson(row.uses, []),
          careTitle: row.care_title,
          care: parseJson(row.care, []),
          promise: row.promise,
          reassurance: parseJson(row.reassurance, []),
          proofReviewId: row.proof_review_id,
          images: imagesByTheme.get(row.theme) || [],
        },
      ]),
    ),
    pages: Object.fromEntries(
      (sets.pages || []).map(row => [
        row.path,
        { title: row.title, body: parseJson(row.body, []), metaDescription: row.meta_description },
      ]),
    ),
    snippets: Object.fromEntries((sets.snippets || []).map(row => [row.key, row.value])),
    lists,
    featuredReviews: (sets.featured || []).map(row => ({
      id: row.id, name: row.name, date: row.date_text, quote: row.quote, proof: row.proof, rating: row.rating,
    })),
    reviewCount: sets.reviewCount?.[0]?.n ?? 0,
    // A row that exists but holds an empty string counts as unset: the setting is
    // allowed to be blank ("not configured"), and a blank mailto on the shop would be
    // worse than a slightly out-of-date one.
    contactEmail: (sets.contact?.[0]?.value || '').trim() || DEFAULT_CONTACT_EMAIL,
  }
}
