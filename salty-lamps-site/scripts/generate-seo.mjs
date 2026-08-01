import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
const snapshot = readSnapshot()
const { products, categories, shopperPaths, pages: policyPages, siteUrl, categoryAliases } = snapshot

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
    image: '/media/logo.png',
  },
  ...Object.entries(policyPages).map(([pathName, page]) => ({
    path: pathName,
    title: `${page.title} | Salty Lamps`,
    description: page.body[0],
    image: '/media/logo.png',
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
  if (!route.products?.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: route.title.replace(' | Salty Lamps', ''),
    description: route.description,
    url: absolute(route.path),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: route.products.slice(0, 48).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absolute(productRoute(product)),
        name: product.name,
      })),
    },
  }
}

function productSchema(product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku || undefined,
    image: [asset(product.image)],
    brand: {
      '@type': 'Brand',
      name: 'Salty Lamps',
    },
    offers: {
      '@type': 'Offer',
      url: absolute(productRoute(product)),
      priceCurrency: 'GBP',
      price: product.price,
      availability: product.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Salty Lamps Ltd',
      },
    },
  }
}

function storeSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Salty Lamps',
    url: siteUrl,
    telephone: '01782970001',
    email: 'info@saltylamps.co.uk',
    image: asset('/media/logo.png'),
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Unit 41, Imex Business Park, Ormonde Street',
      addressLocality: 'Stoke-on-Trent',
      postalCode: 'ST4 3NP',
      addressCountry: 'GB',
    },
  }
}

function schemaFor(route) {
  const schemaItems = [storeSchema()]
  if (route.product) schemaItems.push(productSchema(route.product))
  const list = itemListSchema(route)
  if (list) schemaItems.push(list)
  if (route.schema) schemaItems.push(route.schema)
  return schemaItems.length === 1 ? schemaItems[0] : { '@context': 'https://schema.org', '@graph': schemaItems }
}

function injectHead(html, route) {
  const description = htmlEscape(route.description)
  const title = htmlEscape(route.title)
  const canonical = absolute(route.path)
  const image = asset(route.image || '/media/logo.png')
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

console.log(`Generated SEO files and ${routes.length} route-specific HTML shells.`)
