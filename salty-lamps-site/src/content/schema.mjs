// The shop's schema.org structured data, in one place.
//
// WHY THIS MODULE EXISTS. The same three schemas were built twice: once in
// scripts/generate-seo.mjs, for the prerendered HTML a crawler reads, and once in
// src/App.jsx, for the tag the running app maintains as a shopper navigates. Two
// implementations of the same output drift, and this pair had already begun to —
// the build-time Store used `siteUrl` where the runtime used `${siteUrl}/`, so the
// two disagreed about the shop's own address. Nothing detects that: structured
// data fails silently, and the first sign is a rich result quietly not appearing.
//
// This module is the single definition. It is deliberately pure — no imports, no
// environment, no fetch — so the identical code runs under Node during the build
// and in the browser at runtime, in the same way functions/lib/flatten-products.mjs
// is shared between the Worker and the build script for exactly this reason.
//
// WHAT IS DELIBERATELY NOT HERE, and this matters more than what is:
//
//   aggregateRating / review — the shop holds 195 genuine customer reviews, but
//     not one of them carries a star rating; they are free text. Google's review
//     snippet requires reviewRating, so emitting these would mean inventing the
//     numbers. Fabricated ratings are a structured-data policy violation and a
//     manual-action risk, and the penalty falls on the whole domain. If ratings
//     are ever collected, this is where they go.
//
//   hasMerchantReturnPolicy — Google wants returnPolicyCategory and
//     merchantReturnDays. The published policy at /return-refund-policy states no
//     return window at all, so any number here would contradict the page it is
//     supposed to describe. Structured data must match what the customer can read.
//     Publish a window on that page first, then add it here.
//
//   shippingDetails — same reason. The site publishes no delivery rates or times,
//     so there is nothing truthful to declare.
//
// All three are worth having and all three need a business decision before they
// can be added honestly. The migration runbook says so where the owner will see it.

const CONTEXT = 'https://schema.org'

// Rolling a year out. priceValidUntil is what stops Google treating a price as
// indefinitely fresh, and an absent one is a common reason a merchant listing is
// dropped. A year matches how often this catalogue is repriced.
export function priceValidUntil(now = new Date()) {
  const d = new Date(now)
  d.setUTCFullYear(d.getUTCFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export const SHOP = {
  name: 'Salty Lamps',
  legalName: 'Salty Lamps Ltd',
  telephone: '01782970001',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Unit 41, Imex Business Park, Ormonde Street',
    addressLocality: 'Stoke-on-Trent',
    postalCode: 'ST4 3NP',
    addressCountry: 'GB',
  },
}

// The shop itself. `url` always carries its trailing slash: the two callers
// disagreed about this, and a Store whose url does not match the canonical of the
// page it appears on is a mismatch Google can act on.
export function storeSchema({ siteUrl, contactEmail, imageUrl }) {
  return {
    '@context': CONTEXT,
    '@type': 'Store',
    name: SHOP.name,
    url: `${String(siteUrl).replace(/\/$/, '')}/`,
    telephone: SHOP.telephone,
    email: contactEmail || undefined,
    image: imageUrl || undefined,
    address: SHOP.address,
  }
}

// One product. `product` is a flattened row from functions/lib/flatten-products.mjs
// — so one entry per variant, which is exactly what a Product schema should
// describe, since each variant is its own page with its own price and stock.
//
// `url` and `imageUrl` are passed in rather than built here, because the build
// script and the browser resolve absolute URLs by different routes and neither
// should be reimplemented in this file.
export function productSchema(product, { url, imageUrl, categoryName, now } = {}) {
  if (!product) return null
  return {
    '@context': CONTEXT,
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    sku: product.sku || undefined,
    // An array even when there is one image: Google asks for multiple, and a
    // consumer that expects a list should not have to handle both shapes.
    image: imageUrl ? [imageUrl] : undefined,
    // The shopper-facing category, when the product has one that the site builds
    // a page for. Google added a Category property in 2026 so merchants can
    // classify in markup rather than only in a feed — and this shop has no feed.
    category: categoryName || undefined,
    brand: { '@type': 'Brand', name: SHOP.name },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'GBP',
      price: product.price,
      priceValidUntil: priceValidUntil(now),
      availability: product.stock ? `${CONTEXT}/InStock` : `${CONTEXT}/OutOfStock`,
      itemCondition: `${CONTEXT}/NewCondition`,
      seller: { '@type': 'Organization', name: SHOP.legalName },
    },
  }
}

// A listing page — the shop, a category, a collection. Capped at 48 entries
// because an ItemList is a summary for a search result, not a second copy of the
// catalogue, and a very long one is ignored rather than rewarded.
export function listSchema({ name, description, url, products, urlOf }) {
  if (!products?.length) return null
  return {
    '@context': CONTEXT,
    '@type': 'CollectionPage',
    name,
    description,
    url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.slice(0, 48).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: urlOf(product),
        name: product.name,
      })),
    },
  }
}

// Several schemas on one page become a @graph rather than an array of separate
// blocks: Google reads either, but a graph lets the nodes reference each other
// later without restructuring the output.
export function combineSchemas(schemas) {
  const present = schemas.filter(Boolean)
  if (!present.length) return null
  if (present.length === 1) return present[0]
  return { '@context': CONTEXT, '@graph': present.map(({ '@context': _drop, ...rest }) => rest) }
}
