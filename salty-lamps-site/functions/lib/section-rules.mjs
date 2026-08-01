// Declarative membership rules for collection sections.
//
// Sections used to carry JavaScript predicates living in src/App.jsx:
//
//   match: product => product.categories.includes('salt-lamps')
//                  && !product.categories.includes('special-deal')
//
// A predicate cannot be stored in a database or edited by a non-developer, so the
// same condition is now data:
//
//   { "categories": { "any": ["salt-lamps"], "none": ["special-deal"] } }
//
// SHAPE
//   { categories: { any: [], all: [], none: [] },
//     tags:       { any: [], all: [], none: [] } }
//
//   any   — the product has AT LEAST ONE of these
//   all   — the product has EVERY one of these
//   none  — the product has NONE of these
//
//   Absent or empty clauses are skipped. `{}` therefore matches everything, which is
//   exactly the old behaviour of a subgroup written without a `match` — the catch-all
//   "rest" band. That equivalence is deliberate: it means the trailing band needs no
//   special case anywhere.
//
// WHY `all` EXISTS. Only one rule needs it today — "equestrian AND special-deal" for
// the bulk-supply band. Without `all` that rule would have to lean on the
// collection's category pre-filter to be correct, and would silently start matching
// the wrong products the moment someone edited collection membership in admin.
//
// TAG COMPARISON is slugified at BOTH ends. The original rules were written in
// TitleCase ('Hosting', 'Pantry') while the admin validator stores lowercase slugs,
// so a tag typed into the admin could never have matched a rule written in code.
// Comparing through slugify is what makes the tag-driven bands reachable at all.
//
// MUST stay pure: no DB, no React, no Worker APIs. Imported by the Worker
// (/api/content consumers), the storefront, and the build-time extractor — all three
// must agree, so there is exactly one implementation.

export const slugifyTag = value =>
  String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const asList = v => (Array.isArray(v) ? v : [])

function matchesClause(have, clause) {
  if (!clause) return true
  const set = new Set(have)
  const any = asList(clause.any)
  const all = asList(clause.all)
  const none = asList(clause.none)

  if (any.length && !any.some(v => set.has(v))) return false
  if (all.length && !all.every(v => set.has(v))) return false
  if (none.length && none.some(v => set.has(v))) return false
  return true
}

/** Does `product` satisfy `rule`? An empty or missing rule matches everything. */
export function matchesRule(product, rule) {
  if (!rule || typeof rule !== 'object') return true
  const categories = asList(product?.categories)
  const tags = asList(product?.tags).map(slugifyTag)

  return (
    matchesClause(categories, rule.categories) &&
    matchesClause(tags, normaliseTagClause(rule.tags))
  )
}

// Rule-side tags are slugified too, so a rule authored as 'Bestseller' still matches
// a stored 'bestseller'.
function normaliseTagClause(clause) {
  if (!clause) return null
  return {
    any: asList(clause.any).map(slugifyTag),
    all: asList(clause.all).map(slugifyTag),
    none: asList(clause.none).map(slugifyTag),
  }
}

/** True when a rule constrains nothing — i.e. it is a catch-all band. */
export function isCatchAllRule(rule) {
  if (!rule || typeof rule !== 'object') return true
  for (const group of [rule.categories, rule.tags]) {
    if (!group) continue
    if (asList(group.any).length || asList(group.all).length || asList(group.none).length) return false
  }
  return true
}

export function parseRule(raw) {
  if (raw == null || raw === '') return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // A malformed rule must not take the page down. Matching everything is the
    // safe direction: the section shows too much rather than vanishing.
    return {}
  }
}

/**
 * Build the rendered sections for a collection landing page.
 *
 * Assignment is first-match across sections, so a product appears exactly once, and
 * anything no section claims is swept into a trailing unlabelled section. In-stock
 * items sort ahead of out-of-stock, stably, so the caller's chosen order survives
 * within each group.
 *
 * `sections` is the flat row set from collection_sections: parents have
 * parent_id === null, bands carry their parent's id.
 */
export function buildCollectionSections(sectionRows, items, leftoverTitle = 'More in this range') {
  const ordered = [...items].sort((a, b) => (a.stock === b.stock ? 0 : a.stock ? -1 : 1))

  // A collection with nothing in it gets NO sections, rather than one empty unnamed
  // one. The caller renders a filter chip, a path card and a section heading for every
  // section it is given, so returning a placeholder here painted an untitled chip
  // reading just "0", a heading reading "0 SHOWN" with no name, and a stranded
  // "Recommended route" panel with no products under it. An empty list lets the caller
  // show its empty state instead.
  if (!ordered.length) return []

  const parents = sectionRows.filter(s => s.parent_id == null).sort((a, b) => a.sort_order - b.sort_order)
  const bandsByParent = new Map()
  for (const row of sectionRows.filter(s => s.parent_id != null)) {
    if (!bandsByParent.has(row.parent_id)) bandsByParent.set(row.parent_id, [])
    bandsByParent.get(row.parent_id).push(row)
  }
  for (const list of bandsByParent.values()) list.sort((a, b) => a.sort_order - b.sort_order)

  if (!parents.length) {
    return [{ title: null, descriptor: null, count: ordered.length, groups: [{ label: null, products: ordered }] }]
  }

  const assigned = new Set()
  const sections = []

  for (const section of parents) {
    const rule = parseRule(section.rule)
    const sectionItems = ordered.filter(p => !assigned.has(p.id) && matchesRule(p, rule))
    if (!sectionItems.length) continue
    sectionItems.forEach(p => assigned.add(p.id))

    const bands = bandsByParent.get(section.id) || []
    let groups
    if (bands.length) {
      const used = new Set()
      groups = bands
        .map(band => {
          const bandRule = parseRule(band.rule)
          const groupItems = sectionItems.filter(p => !used.has(p.id) && matchesRule(p, bandRule))
          groupItems.forEach(p => used.add(p.id))
          return { label: band.title, products: groupItems }
        })
        .filter(g => g.products.length)
      // Collapse to a flat grid when only one band actually has products — a single
      // labelled band reads as a mislabelled section rather than a subdivision.
      if (groups.length <= 1) groups = [{ label: null, products: sectionItems }]
    } else {
      groups = [{ label: null, products: sectionItems }]
    }

    sections.push({
      id: section.anchor_id,
      title: section.title,
      descriptor: section.descriptor,
      cardText: section.card_text,
      recommendation: section.recommendation,
      image: section.image,
      theme: section.theme,
      categorySlug: section.category_slug,
      count: sectionItems.length,
      groups,
    })
  }

  const leftover = ordered.filter(p => !assigned.has(p.id))
  if (leftover.length) {
    sections.push({ title: leftoverTitle, descriptor: null, count: leftover.length, groups: [{ label: null, products: leftover }] })
  }
  return sections
}
