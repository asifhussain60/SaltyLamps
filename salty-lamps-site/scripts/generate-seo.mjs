import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PRODUCTS_QUERY, flattenProductRows } from '../functions/lib/flatten-products.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const appPath = path.join(root, 'src/App.jsx')
const distDir = path.join(root, 'dist')
const siteUrl = 'https://www.saltylamps.co.uk'
const today = new Date().toISOString().slice(0, 10)

const appSource = fs.readFileSync(appPath, 'utf8')

const img = name => `/media/live-site-products/${name}`
const media = name => `/media/${name}`

function extractConst(name, nextName) {
  const start = appSource.indexOf(`const ${name} = `)
  if (start === -1) throw new Error(`Could not find ${name}`)

  const valueStart = start + `const ${name} = `.length
  const end = nextName
    ? appSource.indexOf(`\n\nconst ${nextName}`, valueStart)
    : appSource.indexOf('\n\nfunction ', valueStart)

  if (end === -1) throw new Error(`Could not find end of ${name}`)
  return appSource.slice(valueStart, end).trim()
}

function evalValue(source) {
  return Function('img', 'media', `return (${source})`)(img, media)
}

// Products now live in Cloudflare D1, not in App.jsx source. Query D1's HTTP API
// directly (not the live /api/products endpoint) so this build step doesn't
// depend on a deployment that hasn't happened yet — flattening logic is shared
// with functions/api/products.js via flatten-products.mjs, kept in sync there.
function keychainSecret(service, account = 'salty-lamps-proposal') {
  try {
    return execFileSync('security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

async function fetchProductsFromD1() {
  const token = process.env.CLOUDFLARE_D1_TOKEN || keychainSecret('salty-lamps-proposal-cloudflare-d1-token')
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || keychainSecret('salty-lamps-proposal-cloudflare-account-id')
  const databaseId = 'e8e40717-628d-481d-9175-e9c473620125'
  if (!token || !accountId) throw new Error('Missing Cloudflare D1 token/account id (check Keychain or env vars)')

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql: PRODUCTS_QUERY }),
    },
  )
  const body = await res.json()
  if (!body.success) throw new Error(`D1 query failed: ${JSON.stringify(body.errors)}`)
  return flattenProductRows(body.result[0].results)
}

const products = await fetchProductsFromD1()
const categories = evalValue(extractConst('categories', 'shopperPaths'))
const shopperPaths = evalValue(extractConst('shopperPaths', 'processSteps'))
const policyPages = evalValue(extractConst('pages', 'categoryPageCopy'))

const legacyCategorySlug = 'himalyan-salt-massage-relaxation-products'
const cleanCategorySlug = 'himalayan-salt-massage-relaxation-products'

const cleanSlug = slug => (slug === legacyCategorySlug ? cleanCategorySlug : slug)
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
