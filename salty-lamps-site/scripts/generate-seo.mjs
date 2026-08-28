import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CONTACT_EMAIL } from '../functions/lib/content-queries.mjs'
// The Store, Product and CollectionPage schemas are defined once and shared with
// the runtime copy in src/App.jsx. They used to be written out twice and had
// already drifted — see the header of that module.
import { combineSchemas, listSchema, productSchema, storeSchema } from '../src/content/schema.mjs'
import { makeTaxonomy } from '../src/content/taxonomy.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const today = new Date().toISOString().slice(0, 10)

// Content comes from the committed build snapshot written by
// scripts/fetch-content-snapshot.mjs, which runs first in `npm run build`.
//
// This used to text-scrape src/App.jsx (indexOf slicing + Function() eval) for
// `categories`, `shopperPaths` and `pages`. That coupled the build to the literal
// source layout of App.jsx three separate ways — the exact `const <name> = ` text,
// the next const following immediately, and an eval sandbox exposing only
// img/media — so renaming or reordering a const broke `npm run build` outright.
//
// Snapshot v2 moved the taxonomy and the whole marketing layer into D1, so the
// collections and policy pages now come out of `content` rather than being top-level
// copies of hardcoded modules. Everything downstream reads the same field names, so
// only this unpacking changed.
const snapshot = readSnapshot()
const { products, categories, siteUrl, categoryAliases } = snapshot
const content = snapshot.content || {}
// Falls back for a snapshot written before the address was part of the content layer.
// The Store schema is consumed by search engines, so an absent address has to become
// the previous published one rather than `undefined` in the JSON-LD.
const contactEmail = content.contactEmail || DEFAULT_CONTACT_EMAIL
const shopperPaths = content.collections || []
const policyPages = content.pages || {}

if (!shopperPaths.length) {
  throw new Error(
    'The snapshot has no collections.\n'
    + '  Every /collection/* route and its sitemap entries would silently vanish.\n'
    + '  Check that migration 004 is applied to the database the snapshot was taken from.',
  )
}

function readSnapshot() {
  const snapshotPath = path.join(root, 'src/content/content-snapshot.json')
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(
      `Missing ${path.relative(root, snapshotPath)}.\n`
      + '  Run `node scripts/fetch-content-snapshot.mjs` first, or use `npm run build`\n'
      + '  which runs it as its first step.',
    )
  }
  return JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
}

const cleanSlug = slug => categoryAliases[slug] || slug
const categoryRoute = slug => `/category/${cleanSlug(slug)}`
const collectionRoute = (collectionSlug, categorySlug) =>
  categorySlug ? `/collection/${collectionSlug}/${cleanSlug(categorySlug)}` : `/collection/${collectionSlug}`
const productRoute = product => `/product-page/${product.slug}`
const absolute = urlPath => `${siteUrl}${urlPath}`
const asset = urlPath => `${siteUrl}${urlPath}`

const staticRoutes = [
  {
    path: '/',
    title: 'Salty Lamps | Himalayan Salt Lamps, Gifts, Saltware and Trade Supply',
    description:
      'Shop Himalayan salt lamps, candle holders, kitchen saltware, salt bricks, salt licks, and trade stock from Salty Lamps Ltd in Stoke-on-Trent.',
    image: '/media/video/salty-lamps-homepage-hero-poster-16x9.jpg',
  },
  {
    path: '/shop',
    title: 'Shop Himalayan Salt Lamps, Saltware and Salt Licks | Salty Lamps',
    description:
      'Browse Himalayan salt lamps, candle holders, kitchen saltware, salt bricks, salt licks, accessories, and trade-ready stock.',
    image: '/media/live-site-products/lamp-sphere-gemini.jpg',
  },
  {
    path: '/gallery',
    title: 'Gallery | Salty Lamps',
    description:
      'Browse Salty Lamps product details, lifestyle scenes, salt wall references, kitchen saltware, and equestrian salt lick imagery.',
    image: '/media/yoga-room.png',
  },
  {
    path: '/process',
    title: 'Manufacturing Process | Salty Lamps',
    description:
      'See how Salty Lamps products move from mined Himalayan rock salt to cut, finished, packed lamps, bricks, bowls, and tiles.',
    image: '/media/video/salty-lamps-manufacturing-process-poster-16x9.jpg',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'Salty Lamps Manufacturing Process',
      description:
        'Manufacturing process for Salty Lamps Himalayan rock salt products, from raw rock salt through sorting, cutting, finishing, packing, and export.',
      thumbnailUrl: [asset('/media/video/salty-lamps-manufacturing-process-poster-16x9.jpg')],
      uploadDate: today,
      contentUrl: asset('/media/video/salty-lamps-manufacturing-process-16x9.mp4'),
    },
  },
  {
    path: '/reviews',
    title: 'Customer Reviews | Salty Lamps',
    description:
      'Read verified Salty Lamps guestbook feedback about product quality, delivery, packaging, customer service, and repeat buying.',
    image: '/media/live-site-products/lamp-natural-gemini.jpg',
  },
  {
    path: '/return-refund-policy',
    title: 'Returns and Exchanges | Salty Lamps',
    description:
      'Review Salty Lamps return and exchange next steps, return conditions, authorisation process, and support contact details.',
    image: '/media/salty-lamps-og-card.jpg',
  },
  ...Object.entries(policyPages).map(([pathName, page]) => ({
    path: pathName,
    title: `${page.title} | Salty Lamps`,
    description: page.body[0],
    image: '/media/salty-lamps-og-card.jpg',
  })),
  // NOTE: /admin/* is intentionally excluded from prerender + sitemap (noindex).
  // The admin portal is a client-only, auth-gated SPA subtree; it must not be
  // crawled or statically emitted.
]

const productRoutes = products.map(product => ({
  path: productRoute(product),
  title: `${product.name} | Salty Lamps`,
  description: product.description,
  image: product.image,
  product,
}))

const categoryRoutes = categories
  .filter(category => category.slug !== 'all-products')
  .map(category => ({
    path: categoryRoute(category.slug),
    title: `${category.name} | Salty Lamps`,
    description: category.description,
    image: category.image,
    category,
    products: products.filter(product => product.categories.includes(category.slug)),
  }))

const collectionRoutes = shopperPaths.flatMap(shopperPath => [
  {
    path: collectionRoute(shopperPath.slug),
    title: `${shopperPath.name} | Salty Lamps`,
    description: shopperPath.description,
    image: shopperPath.background,
    shopperPath,
    products: products.filter(product => product.categories.some(slug => shopperPath.categories.includes(slug))),
  },
  ...shopperPath.categories.map(categorySlug => {
    const category = categories.find(item => item.slug === categorySlug)
    return {
      path: collectionRoute(shopperPath.slug, categorySlug),
      title: `${category?.name || shopperPath.name} for ${shopperPath.shortName} | Salty Lamps`,
      description: category?.description || shopperPath.description,
      image: category?.image || shopperPath.background,
      shopperPath,
      category,
      products: products.filter(product => product.categories.includes(categorySlug)),
    }
  }),
])

const routes = [
  ...new Map(
    [...staticRoutes, ...productRoutes, ...categoryRoutes, ...collectionRoutes].map(route => [route.path, route]),
  ).values(),
]

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function sitemapUrlEntries(items, extra = '') {
  return items
    .filter(item => !item.excludeFromSitemap)
    .map(
      item => `  <url>
    <loc>${xmlEscape(absolute(item.path))}</loc>
    <lastmod>${today}</lastmod>${extra ? `\n${extra(item)}` : ''}
  </url>`,
    )
    .join('\n')
}

function sitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

function itemListSchema(route) {
  return listSchema({
    name: route.title.replace(' | Salty Lamps', ''),
    description: route.description,
    url: absolute(route.path),
    products: route.products,
    urlOf: product => absolute(productRoute(product)),
  })
}

// Adapters. The schema shapes live in src/content/schema.mjs; these supply the
// two things only this build script knows — how to make a URL absolute, and which
// category the site actually builds a page for.
function buildProductSchema(product) {
  return productSchema(product, {
    url: absolute(productRoute(product)),
    imageUrl: asset(product.image),
    categoryName: primaryCategoryName(product),
  })
}

// The same taxonomy the storefront builds, from the same snapshot, so the category
// named in a product's schema is the one its page actually sits under. Reused
// rather than reimplemented: primaryCategoryOf() skips the catch-all bucket by
// reading is_virtual rather than hardcoding 'all-products', so adding another
// bucket later needs no change here.
const schemaTaxonomy = makeTaxonomy(categories, categoryAliases)

function primaryCategoryName(product) {
  return schemaTaxonomy.nameOf(schemaTaxonomy.primaryCategoryOf(product))
}

function buildStoreSchema() {
  return storeSchema({
    siteUrl,
    contactEmail,
    imageUrl: asset('/media/salty-lamps-og-card.jpg'),
  })
}

// Google renders a BreadcrumbList as the clickable trail that replaces the grey
// URL line in a search result — "Salty Lamps › Salt Lamps › Angel Shape" instead
// of the raw path. It is the cheapest click-through improvement available here,
// and on a shop whose product slugs are long and variant-suffixed it is a large
// legibility win.
//
// The trail must mirror a path the site can actually be navigated by, or Google
// reports it as invalid. Each arm below therefore reuses the same route helpers
// (`categoryRoute`, `collectionRoute`) that generate the real links.
function breadcrumbSchema(route) {
  if (route.path === '/') return null

  const crumbs = [{ name: 'Home', path: '/' }]

  if (route.product) {
    // A product route carries slugs rather than a resolved category, so find the
    // first category that actually exists in the taxonomy. A product whose only
    // categories were filtered out gets Home › Shop › Product rather than a
    // broken middle crumb.
    //
    // `all-products` must be skipped for exactly that reason: every product is in
    // it, so it wins the `find` on every page, and `categoryRoutes` deliberately
    // excludes it — the crumb would have linked to /category/all-products, which
    // this site does not build. Google reports a breadcrumb item pointing at a
    // 404 as an invalid structured-data error for the whole page.
    const category = categories.find(
      item => item.slug !== 'all-products' && route.product.categories?.includes(item.slug),
    )
    if (category) crumbs.push({ name: category.name, path: categoryRoute(category.slug) })
    else crumbs.push({ name: 'Shop', path: '/shop' })
    crumbs.push({ name: route.product.name, path: route.path })
  } else if (route.shopperPath) {
    crumbs.push({ name: route.shopperPath.name, path: collectionRoute(route.shopperPath.slug) })
    if (route.category) crumbs.push({ name: route.category.name, path: route.path })
  } else if (route.category) {
    crumbs.push({ name: 'Shop', path: '/shop' })
    crumbs.push({ name: route.category.name, path: route.path })
  } else {
    crumbs.push({ name: route.title.replace(' | Salty Lamps', ''), path: route.path })
  }

  // A two-item trail of Home › Self on a top-level page tells a search engine
  // nothing it cannot see from the URL, so emit nothing rather than noise.
  if (crumbs.length < 3 && !route.shopperPath) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  }
}

function schemaFor(route) {
  return combineSchemas([
    buildStoreSchema(),
    breadcrumbSchema(route),
    route.product ? buildProductSchema(route.product) : null,
    itemListSchema(route),
    route.schema,
  ])
}

function injectHead(html, route) {
  const description = htmlEscape(route.description)
  const title = htmlEscape(route.title)
  const canonical = absolute(route.path)
  // Landscape 1200x630, not the square emblem: every platform that renders a share
  // preview crops toward that ratio, so a square would be letterboxed or cropped
  // through the wordmark. Regenerate with scripts/generate-brand-assets.py.
  const image = asset(route.image || '/media/salty-lamps-og-card.jpg')
  const robots = route.robots || 'index,follow'
  const schemaJson = JSON.stringify(schemaFor(route)).replaceAll('</script', '<\\/script')

  let output = html
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content=".*?" \/>/s,
      `<meta name="description" content="${description}" />`,
    )

  const seoTags = `    <link rel="canonical" href="${canonical}" />
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="${route.product ? 'product' : 'website'}" />
    <meta property="og:site_name" content="Salty Lamps" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json" data-prerender-jsonld>${schemaJson}</script>`

  output = output.replace('  </head>', `${seoTags}\n  </head>`)
  return output
}

function flatRouteHtmlPath(routePath) {
  if (routePath === '/') return path.join(distDir, 'index.html')
  return path.join(distDir, `${routePath.replace(/^\/+/, '')}.html`)
}

const baseHtml = fs
  .readFileSync(path.join(distDir, 'index.html'), 'utf8')
  .replaceAll('src="./assets/', 'src="/assets/')
  .replaceAll('href="./assets/', 'href="/assets/')

for (const route of routes) {
  const html = injectHead(baseHtml, route)
  // Emit a SINGLE flat `<route>.html`. Cloudflare Pages serves `foo.html` at
  // the clean URL `/foo` natively (and 308s `/foo.html` -> `/foo`). Emitting
  // BOTH `<route>.html` and `<route>/index.html`, plus `_redirects` rewrites
  // to `.html`, made Pages canonicalization loop — every sub-route 308'd to
  // itself. One flat file + Pages' native serving is loop-free.
  writeFile(flatRouteHtmlPath(route.path), html)
}

// No per-route `_redirects` rewrites: a rule like `/foo /foo.html 200` gets
// 308'd straight back to `/foo` by Cloudflare Pages' `.html` canonicalization,
// producing an infinite loop. Pages serves the flat `.html` files above with no
// rule; the SPA catch-all (`/* /index.html 200`) in public/_redirects still
// covers any shell-less route.

writeFile(
  path.join(distDir, 'robots.txt'),
  `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${siteUrl}/sitemap.xml
`,
)

writeFile(
  path.join(distDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${siteUrl}/pages-sitemap.xml</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${siteUrl}/products-sitemap.xml</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${siteUrl}/categories-sitemap.xml</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${siteUrl}/images-sitemap.xml</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${siteUrl}/videos-sitemap.xml</loc><lastmod>${today}</lastmod></sitemap>
</sitemapindex>
`,
)

writeFile(path.join(distDir, 'pages-sitemap.xml'), sitemap(sitemapUrlEntries(staticRoutes)))
writeFile(path.join(distDir, 'products-sitemap.xml'), sitemap(sitemapUrlEntries(productRoutes)))
writeFile(path.join(distDir, 'categories-sitemap.xml'), sitemap(sitemapUrlEntries([...categoryRoutes, ...collectionRoutes])))

writeFile(
  path.join(distDir, 'images-sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${products
  .map(
    product => `  <url>
    <loc>${xmlEscape(absolute(productRoute(product)))}</loc>
    <image:image>
      <image:loc>${xmlEscape(asset(product.image))}</image:loc>
      <image:title>${xmlEscape(product.name)}</image:title>
    </image:image>
  </url>`,
  )
  .join('\n')}
</urlset>
`,
)

const videos = [
  {
    page: '/',
    title: 'Salty Lamps Product Film',
    description: 'A product film showing Salty Lamps ranges for homes, gifts, kitchens, spas, and trade buyers.',
    thumbnail: '/media/video/salty-lamps-homepage-hero-poster-16x9.jpg',
    content: '/media/video/salty-lamps-homepage-hero-16x9.mp4',
  },
  {
    page: '/process',
    title: 'Salty Lamps Manufacturing Process',
    description: 'A manufacturing film showing how Himalayan rock salt products are sorted, cut, finished, packed, and exported.',
    thumbnail: '/media/video/salty-lamps-manufacturing-process-poster-16x9.jpg',
    content: '/media/video/salty-lamps-manufacturing-process-16x9.mp4',
  },
  ...shopperPaths.map(pathItem => ({
    page: collectionRoute(pathItem.slug),
    title: `${pathItem.name} Collection Film`,
    description: pathItem.description,
    thumbnail: pathItem.heroPoster,
    content: pathItem.heroVideo,
  })),
]

writeFile(
  path.join(distDir, 'videos-sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${videos
  .map(
    video => `  <url>
    <loc>${xmlEscape(absolute(video.page))}</loc>
    <video:video>
      <video:thumbnail_loc>${xmlEscape(asset(video.thumbnail))}</video:thumbnail_loc>
      <video:title>${xmlEscape(video.title)}</video:title>
      <video:description>${xmlEscape(video.description)}</video:description>
      <video:content_loc>${xmlEscape(asset(video.content))}</video:content_loc>
    </video:video>
  </url>`,
  )
  .join('\n')}
</urlset>
`,
)

// ---------------------------------------------------------------------------
// Every referenced media file must actually exist.
//
// This exists because it already went wrong. The manufacturing film was dropped from
// the repo during an unrelated refactor while three references to it survived: the
// play button on /process, the poster beside it, and — worst — a VideoObject in the
// structured data telling Google the file was there. The build was perfectly happy.
// The page shipped with a player that could never play, and stayed that way until
// somebody clicked it.
//
// A missing image or video is invisible to every other check here: sitemaps still
// generate, routes still render, nothing throws. So it gets its own assertion, and it
// fails the build rather than warning, because a warning in a build log is exactly
// what nobody read last time.
function assertReferencedMediaExists() {
  const referenced = new Set()
  const collect = value => {
    if (typeof value === 'string') {
      if (value.startsWith('/media/')) referenced.add(value.split('?')[0])
    } else if (Array.isArray(value)) {
      value.forEach(collect)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(collect)
    }
  }
  collect(content)
  collect(categories)
  // The videos this script declares to search engines, which are the ones a broken
  // reference costs the most.
  collect(videos)

  const missing = [...referenced].filter(ref => !fs.existsSync(path.join(root, 'public', ref)))
  if (missing.length) {
    throw new Error(
      `${missing.length} referenced media file(s) do not exist in public/:\n`
      + missing.map(m => `    ${m}`).join('\n')
      + '\n  The page would render a broken image or an unplayable video, and any'
      + '\n  structured data pointing at it would advertise a 404 to search engines.'
      + '\n  Restore the file (check `git log --diff-filter=D -- <path>`) or remove the reference.',
    )
  }
  console.log(`  ✓ all ${referenced.size} referenced media files present`)
}

assertReferencedMediaExists()

console.log(`Generated SEO files and ${routes.length} route-specific HTML shells.`)
