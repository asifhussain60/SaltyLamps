import React, { useEffect, useMemo, useState } from 'react'
import AdminApp from './admin/AdminApp.jsx'
import { img, media, siteUrl } from './content/site-content.mjs'
import { makeTaxonomy } from './content/taxonomy.mjs'
import { buildCollectionSections } from '../functions/lib/section-rules.mjs'
import { DEFAULT_CONTACT_EMAIL } from '../functions/lib/content-queries.mjs'
import snapshot from './content/content-snapshot.json'

const money = value =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value)

const priceLabel = product => money(product.price)

// First-paint taxonomy and copy, from the snapshot committed at build time. The live
// values arrive from /api/categories and /api/content a moment later and replace it.
//
// This is why the shop has no copy or category loading state: there is real content to
// render immediately, with no network round-trip, and a failed fetch degrades to the
// last deployed content rather than an empty nav and blank headings.
const SNAPSHOT_TAXONOMY = makeTaxonomy(snapshot.categories || [], snapshot.categoryAliases || {})

// Everything the marketing layer needs, with the same shape whether it came from the
// snapshot or from /api/content. Nothing below reads a hardcoded string.
const EMPTY_CONTENT = {
  collections: [], themes: {}, pages: {}, snippets: {}, lists: {}, featuredReviews: [], reviewCount: 0,
  contactEmail: DEFAULT_CONTACT_EMAIL,
}
const SNAPSHOT_CONTENT = { ...EMPTY_CONTENT, ...(snapshot.content || {}) }

// A missing snippet renders its key rather than an empty gap, so a copy row deleted by
// accident is visible in testing instead of silently blanking a heading.
const snippet = (content, key, fallback = '') => content.snippets?.[key] ?? fallback ?? key

// The shop's own contact address, from the same admin setting the order and enquiry
// alerts are sent to. Unlike a snippet this never falls back to its key: the value goes
// straight into `mailto:` hrefs and into schema.org output, where a placeholder would be
// a broken link and an invalid feed rather than an obvious missing-copy marker.
const contactEmailOf = content => content.contactEmail || DEFAULT_CONTACT_EMAIL
const contactMailto = (content, subject = '') =>
  `mailto:${contactEmailOf(content)}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`

const siteTitleOf = content => snippet(content, 'site.title', 'Salty Lamps')
const siteDescriptionOf = content => snippet(content, 'site.description', '')
const pageTitleOf = (content, title) => (title ? `${title} | Salty Lamps` : siteTitleOf(content))

const shopCopyOf = content => ({
  eyebrow: snippet(content, 'shop.eyebrow'),
  title: snippet(content, 'shop.title'),
  description: snippet(content, 'shop.description'),
})
const notFoundCopyOf = content => ({
  eyebrow: snippet(content, 'not_found.eyebrow'),
  title: snippet(content, 'not_found.title'),
  description: snippet(content, 'not_found.description'),
})

const themeContentOf = (content, theme) => content.themes?.[theme] || content.themes?.lamp || {}

const initialsFor = name =>
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

// Theme-generic stock photography, used ONLY as a fallback for a product whose own
// gallery has nothing beyond its primary image. Every product currently has exactly
// one gallery row, so this is still what most product pages show — but it is the
// exception rather than the rule, and it disappears per-product as real photographs
// are uploaded through the admin gallery.
const supportImagesForTheme = (content, theme, primaryImage) => {
  const productSupport = themeContentOf(content, theme).images || []
  const lampSupport = content.themes?.lamp?.images || []
  const seen = new Set([primaryImage])
  return [...productSupport, ...lampSupport]
    .filter(item => {
      if (seen.has(item.src)) return false
      seen.add(item.src)
      return true
    })
    .slice(0, 2)
}

// A product's detail thumbnails: its own gallery when it has one, theme stock photos
// otherwise. The gallery's first entry is the primary image already shown large, so
// it is dropped here.
const detailImagesFor = (content, product, theme) => {
  const gallery = (product.images || []).filter(src => src !== product.image)
  if (gallery.length) return gallery.map(src => ({ src, alt: product.name }))
  return supportImagesForTheme(content, theme, product.image)
}

// `lede` is stored as a template containing {name}; one theme row serves every product
// in that theme, so the interpolation happens here at read time.
const productSellingContent = (content, taxonomy, product) => {
  const theme = taxonomy.themeForProduct(product)
  const themeCopy = themeContentOf(content, theme)
  return {
    ...themeCopy,
    category: taxonomy.nameOf(taxonomy.primaryCategoryOf(product)),
    lede: String(themeCopy.lede || '').replace(/\{name\}/g, product.name),
  }
}

// These take the theme string rather than the product, so they need no taxonomy at
// all — which keeps most of the churn out of the marketing-copy helpers.
const productReassurance = (content, theme) => themeContentOf(content, theme).reassurance || []

const productProof = (content, theme) => {
  const wanted = themeContentOf(content, theme).proofReviewId
  const featured = content.featuredReviews || []
  return featured.find(r => r.id === wanted) || featured[0] || null
}

const productVisibleReviews = (content, theme) => {
  const primary = productProof(content, theme)
  const featured = content.featuredReviews || []
  if (!primary) return featured.slice(0, 3)
  return [primary, ...featured.filter(review => review.id !== primary.id)].slice(0, 3)
}

// Chat, trade enquiry and newsletter signup -> /api/support/enquiry.
//
// These three wrote to Supabase, where nobody was notified — trade leads were
// arriving and sitting unread. They now post to our own endpoint, which stores the
// row in D1 (visible in admin under Emails -> Enquiries) and emails the owner.
// Historical Supabase rows are left untouched in Supabase.
//
// The localStorage copy stays. It costs nothing and it is the only record the
// shopper keeps of what they sent.
const persistSubmission = async (source, payload) => {
  const submission = { ...payload, createdAt: new Date().toISOString() }

  try {
    const key = `salty-lamps-${source}`
    const existing = JSON.parse(window.localStorage.getItem(key) || '[]')
    window.localStorage.setItem(key, JSON.stringify([submission, ...existing].slice(0, 80)))
  } catch {
    // Local storage can be blocked in private browsing; the submission still posts.
  }

  const res = await fetch('/api/support/enquiry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source, ...payload }),
  })
  if (!res.ok) throw new Error(`Enquiry submission failed (${res.status})`)
}



const productMatchesPath = (product, path) => product.categories.some(slug => path.categories.includes(slug))


const categoryPageCopy = (content, taxonomy, slug) => {
  const category = taxonomy.get(slug)
  if (!category || category.is_virtual) return shopCopyOf(content)

  return {
    eyebrow: category.name,
    title: `Shop ${category.name.toLowerCase()} from Salty Lamps.`,
    description: category.description,
  }
}

const activePageMeta = ({ content, taxonomy, route, categorySlug, activeShopperPath, currentProduct, page }) => {
  const pageTitle = title => pageTitleOf(content, title)

  if (currentProduct) {
    return {
      title: pageTitle(currentProduct.name),
      description: currentProduct.description,
      image: currentProduct.image,
      type: 'product',
    }
  }

  if (activeShopperPath) {
    return {
      title: pageTitle(activeShopperPath.name),
      description: activeShopperPath.description,
      image: activeShopperPath.background,
    }
  }

  if (categorySlug) {
    const copy = categoryPageCopy(content, taxonomy, categorySlug)
    return {
      title: pageTitle(copy.title),
      description: copy.description,
      image: taxonomy.imageOf(categorySlug) || media('salty-lamps-og-card.jpg'),
    }
  }

  if (route === '/shop') return { title: pageTitle('Shop'), description: shopCopyOf(content).description, image: img('lamp-sphere-gemini.jpg') }
  if (route === '/gallery') return { title: pageTitle('Gallery'), description: 'Browse Salty Lamps product details, lifestyle scenes, and trade-use references.', image: media('yoga-room.png') }
  if (route.startsWith('/admin')) return { title: pageTitle('Admin'), description: 'Salty Lamps admin portal.', image: media('salty-lamps-og-card.jpg'), robots: 'noindex,nofollow' }
  if (route === '/process') return { title: pageTitle('Manufacturing Process'), description: 'See how Salty Lamps products move from mined rock salt to cut, finished, packed products.', image: media('video/salty-lamps-manufacturing-process-poster-16x9.jpg') }
  if (route === '/reviews') return { title: pageTitle('Customer Reviews'), description: 'Read verified Salty Lamps guestbook feedback by customer theme.', image: img('lamp-natural-gemini.jpg') }
  if (route === '/returns-exchanges' || route === '/return-refund-policy') return { title: pageTitle('Returns and Exchanges'), description: 'Review Salty Lamps return and exchange next steps.', image: media('salty-lamps-og-card.jpg') }
  if (route === '/checkout/success') return { title: pageTitle('Order Confirmed'), description: 'Your Salty Lamps order is confirmed.', image: media('salty-lamps-og-card.jpg'), robots: 'noindex,follow' }
  if (route === '/checkout/cancelled') return { title: pageTitle('Checkout Cancelled'), description: 'Your Salty Lamps checkout was cancelled.', image: media('salty-lamps-og-card.jpg'), robots: 'noindex,follow' }
  // noindex like the checkout routes, and for the same reason: a form that needs an
  // order reference is useless to a search visitor, and it is deliberately absent
  // from staticRoutes in scripts/generate-seo.mjs so it never enters a sitemap.
  if (route === '/refund-request') return { title: pageTitle('Request a Refund or Return'), description: 'Start a Salty Lamps return or refund request.', image: media('salty-lamps-og-card.jpg'), robots: 'noindex,follow' }
  // meta_description is an override; falling back to the first paragraph reproduces
  // exactly what this did before the column existed.
  if (page) return { title: pageTitle(page.title), description: page.metaDescription || page.body[0], image: media('salty-lamps-og-card.jpg') }
  if (route === '/') return { title: siteTitleOf(content), description: siteDescriptionOf(content), image: media('video/salty-lamps-homepage-hero-poster-16x9.jpg') }
  const notFound = notFoundCopyOf(content)
  return { title: pageTitle(notFound.title), description: notFound.description, image: media('salty-lamps-og-card.jpg'), robots: 'noindex,follow' }
}


const CART_STORAGE_KEY = 'salty-lamps-cart'

// A non-OK response, or one whose body isn't JSON, must reject rather than resolve to
// something empty — an empty catalogue is indistinguishable from a real "no results"
// once it reaches the grid.
async function readJsonOrThrow(res) {
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}

// Only { skuId, qty } survives a refresh; the product itself is re-attached from the
// live catalogue once it loads, so a stored line can never show a stale price.
function readStoredCart() {
  try {
    const raw = window.sessionStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(line => Number.isInteger(line?.skuId) && Number.isInteger(line?.qty) && line.qty > 0)
      // A placeholder product, replaced by the real one on rehydrate. Priced at 0 so
      // that if anything ever rendered before rehydration it would look obviously
      // wrong rather than plausibly wrong.
      .map(line => ({ key: `sku-${line.skuId}`, qty: line.qty, product: { skuId: line.skuId, price: 0, stock: true } }))
  } catch {
    return []
  }
}

function getRoute() {
  return window.location.pathname === '/index.html' ? '/' : window.location.pathname
}

function absoluteUrl(path) {
  return `${siteUrl}${path}`
}

function ensureMeta(selector, createElement, attrs = {}) {
  let element = document.querySelector(selector)
  if (!element) {
    element = document.createElement(createElement)
    Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value))
    document.head.appendChild(element)
  }
  return element
}

function setMeta(selector, createAttrs, valueAttr, value) {
  const element = ensureMeta(selector, 'meta', createAttrs)
  element.setAttribute(valueAttr, value)
}

function Link({ href, children, className, onClick, ...props }) {
  const handleClick = event => {
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.includes('#')) {
      onClick?.(event)
      return
    }
    event.preventDefault()
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    onClick?.(event)
  }

  return (
    <a href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}

function ProductCard({ taxonomy, product, onQuickView, onAdd, variant = '' }) {
  const groupName = taxonomy.nameOf(taxonomy.primaryCategoryOf(product))
  const variantClass = variant ? ` product-card--${variant}` : ''
  // Only render the badge when there is something to say. It is absolutely
  // positioned with padding and a dark background, so an empty one drew a small
  // dark rectangle on every in-stock card — every product has an empty tags list.
  const badge = product.stock ? product.tags[0] : 'Out of stock'

  return (
    <article className={`product-card theme-${taxonomy.themeForProduct(product)}${variantClass}${product.stock ? '' : ' is-soldout'}`}>
      <Link className="product-image" href={`/product-page/${product.slug}`} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} />
        {badge && <span>{badge}</span>}
      </Link>
      <div className="product-body">
        <p>{groupName}</p>
        <h3>{product.name}</h3>
        <span>{product.description}</span>
      </div>
      <div className="product-meta">
        <strong>{priceLabel(product)}</strong>
        <small>{product.stock ? 'In stock' : 'Currently unavailable'}</small>
      </div>
      <div className="product-actions">
        <button type="button" onClick={() => onQuickView(product.id)}>View</button>
        <button type="button" onClick={() => onAdd(product)} disabled={!product.stock}>
          Add
        </button>
      </div>
    </article>
  )
}

// A field no human ever sees or tabs into. Bots fill every input they find, so a
// non-empty value is the cheapest available bot signal — and the endpoints behind
// these forms are public and send mail, which makes them spam-relay targets.
// Positioned off-screen rather than display:none, which some bots specifically skip.
function Honeypot() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
      <label>
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  )
}

// `content` is passed in rather than read from a module-level constant so the widget
// follows the live address the moment /api/content lands, exactly like every other
// piece of copy on the page.
function ChatModule({ onSubmit, message, content }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`chat-module ${open ? 'open' : ''}`}>
      {open && (
        <form className="chat-panel" onSubmit={onSubmit}>
          <div className="chat-panel-header">
            <div>
              <p className="eyebrow">Salty Lamps support</p>
              <strong>Ask us about products, trade, or orders.</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">Close</button>
          </div>
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Message
            <textarea name="message" rows="4" placeholder="Tell us what you are looking for..." required />
          </label>
          <Honeypot />
          <button type="submit">Send message</button>
          <a href={contactMailto(content, 'Website chat request')}>Open email instead</a>
          {message && <p className="success">{message}</p>}
        </form>
      )}
      <button className="chat-button" type="button" onClick={() => setOpen(current => !current)}>
        {open ? 'Close Chat' : "Let's Chat"}
      </button>
    </div>
  )
}


// The trade panel is 1:1 with the collection and comes down inside it, so an absent
// panel is simply a null `trade` — exactly what the old `collectionTradeCopy[slug]`
// lookup returned for a collection with no trade copy.
function CollectionTradeCta({ path, content }) {
  const trade = path.trade
  if (!trade || !trade.heading) return null
  return (
    <aside className={`collection-trade-cta theme-${path.theme}`}>
      <div>
        <p className="eyebrow">{trade.eyebrow}</p>
        <h3>{trade.heading}</h3>
        <p>{trade.body}</p>
      </div>
      <a className="button primary" href={contactMailto(content, trade.cta)}>
        {trade.cta}
      </a>
    </aside>
  )
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [refund, setRefund] = useState({ status: 'idle', errors: {} })
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  // 'loading' | 'ready' | 'error'. Products used to be a bare array whose fetch
  // failure was swallowed into [], which the shop rendered as "No matching products.
  // Try another search term." — telling customers they had searched wrong during an
  // outage. The three states are now distinct and rendered differently.
  const [catalog, setCatalog] = useState({ status: 'loading', products: [], categories: [], aliases: {}, content: SNAPSHOT_CONTENT })
  const { products } = catalog
  // Never null: the committed snapshot stands in until /api/content lands, so every
  // heading and every piece of selling copy has a real value on the first paint.
  const content = catalog.content || SNAPSHOT_CONTENT
  // The guestbook corpus is only needed by /reviews, so it is fetched on demand
  // rather than shipped in the bundle or bolted onto /api/content.
  const [reviewCorpus, setReviewCorpus] = useState(null)
  const [cart, setCart] = useState(readStoredCart)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [quickViewId, setQuickViewId] = useState(null)
  const [formMessage, setFormMessage] = useState('')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const [chatMessage, setChatMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [heroPlaying, setHeroPlaying] = useState(false)
  const [heroPosterFailed, setHeroPosterFailed] = useState(false)
  const [homeHeroPlaying, setHomeHeroPlaying] = useState(false)
  const [homeHeroPosterFailed, setHomeHeroPosterFailed] = useState(false)
  const [processFilmPlaying, setProcessFilmPlaying] = useState(false)
  const [processFilmPosterFailed, setProcessFilmPosterFailed] = useState(false)
  const [activeCollectionSection, setActiveCollectionSection] = useState('all')

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute())
    window.addEventListener('popstate', updateRoute)
    return () => window.removeEventListener('popstate', updateRoute)
  }, [])

  // All three requests go out together, so the cost is max(a, b, c) rather than the
  // sum, and one state transition covers all of them. loadCatalog is the Retry handler.
  //
  // Content is deliberately NOT allowed to fail the whole load. A products outage must
  // show the error panel, but a content outage should not blank the shop — the
  // committed snapshot is real, last-deployed copy, so falling back to it degrades to
  // slightly stale wording instead of a page with no headings.
  const loadCatalog = React.useCallback(() => {
    let alive = true
    setCatalog(current => ({ ...current, status: 'loading' }))
    Promise.all([
      fetch('/api/products').then(readJsonOrThrow),
      fetch('/api/categories').then(readJsonOrThrow),
      fetch('/api/content').then(readJsonOrThrow).catch(() => null),
    ])
      .then(([productData, categoryData, contentData]) => {
        if (!alive) return
        setCatalog({
          status: 'ready',
          products: productData.products || [],
          categories: categoryData.categories || [],
          aliases: categoryData.aliases || {},
          content: contentData ? { ...EMPTY_CONTENT, ...contentData } : SNAPSHOT_CONTENT,
        })
      })
      .catch(() => alive && setCatalog(current => ({ ...current, status: 'error' })))
    return () => { alive = false }
  }, [])

  useEffect(() => loadCatalog(), [loadCatalog])

  useEffect(() => {
    if (route !== '/reviews' || reviewCorpus) return
    let alive = true
    fetch('/api/reviews')
      .then(readJsonOrThrow)
      .then(data => alive && setReviewCorpus(data.reviews || []))
      .catch(() => alive && setReviewCorpus([]))
    return () => { alive = false }
  }, [route, reviewCorpus])

  // Falls back to the build-time snapshot until the live taxonomy lands, so the nav
  // and category names never render blank or flash.
  const taxonomy = useMemo(
    () => (catalog.categories.length ? makeTaxonomy(catalog.categories, catalog.aliases) : SNAPSHOT_TAXONOMY),
    [catalog.categories, catalog.aliases],
  )

  const collections = content.collections || []
  const featuredReviews = content.featuredReviews || []
  const reviewSignals = content.lists?.['review-signals'] || []
  // Counted server-side so the home page can state it without pulling 185 rows, and
  // so the figure is the number actually shown rather than the raw archive size.
  const reviewCount = content.reviewCount ?? 0
  // The featured quotes are rendered separately above the grid, so they are excluded
  // here rather than appearing twice.
  const corpus = (reviewCorpus || []).filter(review => !review.featured)

  // The order is placed, so the cart must not survive it — otherwise the same items
  // reappear the moment the customer navigates back into the shop.
  useEffect(() => {
    if (route === '/checkout/success') setCart([])
  }, [route])

  // Persist the cart across the Stripe round-trip. Only { skuId, qty } is stored —
  // never price or name, so a stale entry can never render a wrong subtotal. Lines
  // are rehydrated against the live catalogue below, and sessionStorage rather than
  // localStorage because a cart surviving for days is its own bug.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart.map(item => ({ skuId: item.product.skuId, qty: item.qty }))),
      )
    } catch {
      // Private browsing or a full quota. A cart that isn't persisted is a much
      // smaller problem than a checkout that throws.
    }
  }, [cart])

  // Re-attach stored lines to real products once the catalogue is in, dropping
  // anything that has since been deleted or sold out. Without this, a stale skuId
  // would reach /api/checkout and come back as a 400.
  useEffect(() => {
    if (catalog.status !== 'ready') return
    setCart(items => {
      const bySkuId = new Map(catalog.products.map(p => [p.skuId, p]))
      const rehydrated = items
        .map(item => {
          const fresh = bySkuId.get(item.product.skuId)
          if (!fresh || !fresh.stock) return null
          return { ...item, product: fresh, qty: Math.min(item.qty, fresh.stockQty ?? item.qty) }
        })
        .filter(Boolean)
      const unchanged = rehydrated.length === items.length
        && rehydrated.every((item, i) => item.product === items[i].product && item.qty === items[i].qty)
      return unchanged ? items : rehydrated
    })
  }, [catalog.status, catalog.products])

  const categorySlug = route.startsWith('/category/') ? taxonomy.resolve(route.replace('/category/', '')) : null
  const collectionMatch = route.match(/^\/collection\/([^/]+)(?:\/([^/]+))?$/)
  const collectionSlug = collectionMatch?.[1] || null
  const collectionCategorySlug = collectionMatch?.[2] ? taxonomy.resolve(collectionMatch[2]) : null
  const activeShopperPath = collections.find(path => path.slug === collectionSlug)

  // Reset video state whenever the collection changes.
  useEffect(() => {
    setHeroPlaying(false)
    setHeroPosterFailed(false)
  }, [collectionSlug])

  useEffect(() => {
    if (route !== '/') setHomeHeroPlaying(false)
    if (route !== '/process') setProcessFilmPlaying(false)
  }, [route])

  const productSlug = route.startsWith('/product-page/') ? route.replace('/product-page/', '') : null
  const currentProduct = products.find(product => product.slug === productSlug)
  const quickViewProduct = products.find(product => product.id === quickViewId)
  const page = content.pages?.[route]
  // A category route is valid if the taxonomy knows the slug OR any product claims
  // it. The second clause is what makes the site genuinely data-driven: assign a new
  // slug to a product in the admin and its page works immediately, rather than 404ing
  // until someone edits the code.
  const isKnownCategoryRoute = !categorySlug
    || taxonomy.has(categorySlug)
    || products.some(product => product.categories.includes(categorySlug))

  // Nothing can be declared missing until the catalogue has actually loaded.
  // Previously this was computed on first render, when products was still empty, so
  // EVERY product page flashed "This page is not available." before its data arrived.
  const catalogSettled = catalog.status !== 'loading'
  const notFound =
    catalogSettled &&
    !currentProduct &&
    !activeShopperPath &&
    !page &&
    route !== '/' &&
    route !== '/shop' &&
    route !== '/gallery' &&
    !route.startsWith('/admin') &&
    route !== '/process' &&
    route !== '/reviews' &&
    route !== '/returns-exchanges' &&
    route !== '/return-refund-policy' &&
    route !== '/checkout/success' &&
    route !== '/checkout/cancelled' &&
    route !== '/refund-request' &&
    !(categorySlug && isKnownCategoryRoute)
  const meta = notFound
    ? { title: pageTitleOf(content, notFoundCopyOf(content).title), description: notFoundCopyOf(content).description, image: media('salty-lamps-og-card.jpg'), robots: 'noindex,follow' }
    : activePageMeta({ content, taxonomy, route, categorySlug, activeShopperPath, currentProduct, page })
  const canonicalPath = currentProduct
    ? `/product-page/${currentProduct.slug}`
    : collectionSlug
      ? collectionCategorySlug
        ? taxonomy.collectionHref(collectionSlug, collectionCategorySlug)
        : `/collection/${collectionSlug}`
      : categorySlug
        ? taxonomy.href(categorySlug)
        : route === '/returns-exchanges'
          ? '/return-refund-policy'
          : route
  const galleryItems = useMemo(
    () => [
      ...products.slice(0, 18).map((product, index) => ({
        key: product.id,
        name: product.name,
        image: product.image,
        href: `/product-page/${product.slug}`,
        label: taxonomy.nameOf(taxonomy.primaryCategoryOf(product)),
        variant: index % 7 === 0 ? 'wide' : index % 5 === 0 ? 'tall' : '',
      })),
      ...taxonomy.navList.slice(0, 6).map((category, index) => ({
        key: category.slug,
        name: category.name,
        image: category.image,
        href: taxonomy.href(category.slug),
        label: category.name,
        variant: index % 3 === 0 ? 'wide' : '',
      })),
    ],
    [products, taxonomy],
  )
  const galleryShowcaseItems = useMemo(
    () => [
      {
        key: 'home-gifts',
        label: 'Home showcase',
        title: 'Warm rooms, quiet corners, and giftable glow.',
        body: 'Styled lamps and holders for homes, spas, kitchens, and calm retail displays.',
        image: media('yoga-room.png'),
        href: '/collection/home-gifts',
      },
      {
        key: 'kitchen-saltware',
        label: 'Kitchen saltware',
        title: 'Saltware for cooking, serving, and table theatre.',
        body: 'Bowls, platters, shot glasses, and pantry pieces shown in real hosting moments.',
        image: img('salty-chef-family-live-site.png'),
        href: '/collection/kitchen-food',
      },
      {
        key: 'trade-spa',
        label: 'Trade and spa',
        title: 'Salt walls, tiles, bricks, and bulk project supply.',
        body: 'A more architectural look at how the range works for wellness and trade spaces.',
        image: media('home-spa-salt-room-generated.png'),
        href: '/collection/trade-spa',
      },
      {
        key: 'yard-supply',
        label: 'Equestrian',
        title: 'Field, stable, and smallholding supply.',
        body: 'Natural salt licks and yard-ready essentials for repeat rural buyers.',
        image: media('home-horse-salt-lick-generated.png'),
        href: '/collection/horses-farm',
      },
    ],
    [],
  )

  const categoryFilter =
    collectionCategorySlug || (categorySlug && categorySlug !== 'all-products' ? categorySlug : 'all')
  const sidebarCategories = activeShopperPath
    ? taxonomy.list.filter(category => activeShopperPath.categories.includes(category.slug))
    : taxonomy.list
  const collectionProducts = activeShopperPath ? products.filter(product => productMatchesPath(product, activeShopperPath)) : products

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    let list = products.filter(product => {
      const matchesCollection = !activeShopperPath || productMatchesPath(product, activeShopperPath)
      const matchesCategory = categoryFilter === 'all' || product.categories.includes(categoryFilter)
      const haystack = `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase()
      return matchesCollection && matchesCategory && haystack.includes(term)
    })

    if (sort === 'price-low') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'price-high') list = [...list].sort((a, b) => b.price - a.price)
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))

    return list
  }, [products, activeShopperPath, categoryFilter, query, sort])

  // The collection landing (no sub-category, no search) shows the hero + grouped
  // sections; any drill-down or search falls back to the flat result grid.
  const isCollectionRoot = Boolean(activeShopperPath) && categoryFilter === 'all' && !query.trim()
  const collectionSections = isCollectionRoot
    ? buildCollectionSections(activeShopperPath.sections || [], visibleProducts, snippet(content, 'collection.leftover_title', 'More in this range'))
    : []
  const collectionSectionKey = collectionSections
    .map(section => `${section.id || ''}:${section.categorySlug || ''}`)
    .join('|')

  useEffect(() => {
    document.title = meta.title
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', meta.description)
    const canonical = ensureMeta('link[rel="canonical"]', 'link', { rel: 'canonical' })
    const canonicalUrl = absoluteUrl(canonicalPath)
    canonical.setAttribute('href', canonicalUrl)
    setMeta('meta[name="robots"]', { name: 'robots' }, 'content', meta.robots || 'index,follow')
    setMeta('meta[property="og:type"]', { property: 'og:type' }, 'content', meta.type || 'website')
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'content', 'Salty Lamps')
    setMeta('meta[property="og:title"]', { property: 'og:title' }, 'content', meta.title)
    setMeta('meta[property="og:description"]', { property: 'og:description' }, 'content', meta.description)
    setMeta('meta[property="og:url"]', { property: 'og:url' }, 'content', canonicalUrl)
    setMeta('meta[property="og:image"]', { property: 'og:image' }, 'content', absoluteUrl(meta.image || media('salty-lamps-og-card.jpg')))
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'content', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, 'content', meta.title)
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, 'content', meta.description)
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, 'content', absoluteUrl(meta.image || media('salty-lamps-og-card.jpg')))
    document.querySelector('script[data-prerender-jsonld]')?.remove()
  }, [canonicalPath, meta.description, meta.image, meta.robots, meta.title, meta.type])

  useEffect(() => {
    if (!isCollectionRoot || !collectionSections.length) {
      setActiveCollectionSection('all')
      return undefined
    }

    let frame = 0
    const sectionTargets = collectionSections
      .filter(section => section.id)
      .map(section => ({ id: section.id }))

    const updateActiveSection = () => {
      frame = 0
      const activationY = window.innerHeight * 0.62
      let nextSection = 'all'
      let closestSectionTop = Number.NEGATIVE_INFINITY
      const isNearPageEnd =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12

      for (const section of sectionTargets) {
        const element = document.getElementById(section.id)
        if (!element) continue

        const rect = element.getBoundingClientRect()
        if (rect.top <= activationY && rect.top > closestSectionTop) {
          closestSectionTop = rect.top
          nextSection = section.id
        }
      }

      if (isNearPageEnd && sectionTargets.length) {
        nextSection = sectionTargets[sectionTargets.length - 1].id
      }

      setActiveCollectionSection(current => (current === nextSection ? current : nextSection))
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateActiveSection)
    }

    updateActiveSection()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [isCollectionRoot, collectionSectionKey])

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0)

  const addProduct = product => {
    if (!product.stock) return

    const key = String(product.id)
    // A UX affordance only. The checkout endpoint re-reads stock from the database
    // and still returns a 409 — this just means the shopper finds out here rather
    // than at the highest-intent click, and the published depth can be a little
    // stale because of the 60s cache.
    const cap = product.stockQty ?? Infinity
    const existing = cart.find(item => item.key === key)

    if (existing && existing.qty >= cap) {
      setNotice(`Only ${cap} of ${product.name} ${cap === 1 ? 'is' : 'are'} available.`)
      setCartOpen(true)
      return
    }

    setCart(items => (
      items.some(item => item.key === key)
        ? items.map(item => (item.key === key ? { ...item, qty: item.qty + 1 } : item))
        : [...items, { key, product, qty: 1 }]
    ))
    setCartOpen(true)
    setQuickViewId(null)
    setNotice('')
  }

  // Each handler captures the form element BEFORE awaiting. React nulls
  // event.currentTarget once the handler returns, so reading it after an await
  // throws and the form silently never clears.
  const handleTradeSubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const interest = data.get('interest')

    try {
      await persistSubmission('trade', {
        name: data.get('name'),
        email: data.get('email'),
        // The endpoint takes one message field, so the interest dropdown is folded
        // in rather than dropped — it is the most useful line in a trade enquiry.
        message: [interest ? `Interested in: ${interest}` : '', data.get('message')].filter(Boolean).join('\n\n'),
        website: data.get('website'),
      })
    } finally {
      setFormMessage('Thanks for submitting. We will come back to you shortly.')
      form.reset()
    }
  }

  const handleNewsletterSubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    try {
      await persistSubmission('newsletter', {
        email: data.get('email'),
        website: data.get('website'),
      })
    } finally {
      setNewsletterMessage('Thanks for subscribing.')
      form.reset()
    }
  }

  const handleChatSubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    try {
      await persistSubmission('chat', {
        name: data.get('name'),
        email: data.get('email'),
        message: data.get('message'),
        website: data.get('website'),
      })
    } finally {
      setChatMessage('Thanks — your message is with us. We will reply as soon as possible.')
      form.reset()
    }
  }

  const changeQty = (key, delta) => {
    const line = cart.find(item => item.key === key)
    const cap = line?.product.stockQty ?? Infinity
    if (line && delta > 0 && line.qty >= cap) {
      setNotice(`Only ${cap} of ${line.product.name} ${cap === 1 ? 'is' : 'are'} available.`)
      return
    }
    setNotice('')
    setCart(items =>
      items
        .map(item => (item.key === key ? { ...item, qty: Math.min(cap, Math.max(0, item.qty + delta)) } : item))
        .filter(item => item.qty > 0),
    )
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    setNotice('')
    try {
      const items = cart.map(item => ({ skuId: item.product.skuId, quantity: item.qty }))
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNotice(data.error || 'Checkout failed. Please try again.')
        setCheckoutLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setNotice('Checkout failed. Please try again.')
      setCheckoutLoading(false)
    }
  }

  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Salty Lamps',
    url: `${siteUrl}/`,
    telephone: '01782970001',
    email: contactEmailOf(content),
    image: absoluteUrl(media('salty-lamps-og-card.jpg')),
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Unit 41, Imex Business Park, Ormonde Street',
      addressLocality: 'Stoke-on-Trent',
      postalCode: 'ST4 3NP',
      addressCountry: 'GB',
    },
  }

  const productSchema = currentProduct && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: currentProduct.name,
    sku: currentProduct.sku || undefined,
    image: [absoluteUrl(currentProduct.image)],
    description: currentProduct.description,
    brand: {
      '@type': 'Brand',
      name: 'Salty Lamps',
    },
    // Omit the Offer entirely when pricing is TBD — publishing a placeholder
    // price to search engines would be worse than publishing none.
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product-page/${currentProduct.slug}`),
      price: currentProduct.price,
      priceCurrency: 'GBP',
      availability: currentProduct.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Salty Lamps Ltd',
      },
    },
  }

  const listSchema = (route === '/shop' || activeShopperPath || categorySlug) && visibleProducts.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: meta.title.replace(' | Salty Lamps', ''),
        description: meta.description,
        url: absoluteUrl(canonicalPath),
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: visibleProducts.slice(0, 48).map((product, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: absoluteUrl(`/product-page/${product.slug}`),
            name: product.name,
          })),
        },
      }
    : null

  const processSchema = route === '/process'
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: 'Salty Lamps Manufacturing Process',
        description: 'Manufacturing process for Salty Lamps Himalayan rock salt products, from raw rock salt through sorting, cutting, finishing, packing, and export.',
        thumbnailUrl: [absoluteUrl(media('video/salty-lamps-manufacturing-process-poster-16x9.jpg'))],
        uploadDate: '2026-06-22',
        contentUrl: absoluteUrl(media('video/salty-lamps-manufacturing-process-16x9.mp4')),
      }
    : null

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [storeSchema, productSchema, listSchema, processSchema].filter(Boolean),
  }

  const renderShop = () => {
    const shopCopy = categorySlug && isKnownCategoryRoute ? categoryPageCopy(content, taxonomy, categorySlug) : shopCopyOf(content)
    const selectedCategoryCopy = categoryFilter !== 'all' ? categoryPageCopy(content, taxonomy, categoryFilter) : null
    const shopHeadingEyebrow = selectedCategoryCopy
      ? selectedCategoryCopy.eyebrow
      : activeShopperPath
        ? activeShopperPath.eyebrow
        : shopCopy.eyebrow
    const shopHeadingTitle = selectedCategoryCopy
      ? activeShopperPath
        ? `${selectedCategoryCopy.eyebrow} for ${activeShopperPath.shortName.toLowerCase()}`
        : selectedCategoryCopy.title
      : activeShopperPath
        ? activeShopperPath.heading
        : shopCopy.title
    const shopHeadingDescription = selectedCategoryCopy
      ? selectedCategoryCopy.description
      : activeShopperPath
        ? activeShopperPath.description
        : shopCopy.description
    const spotlightCategories = (
      activeShopperPath
        ? taxonomy.navList.filter(category => activeShopperPath.categories.includes(category.slug))
        : taxonomy.navList
    ).slice(0, 3)
    const renderCard = (product, variant) => (
      <ProductCard
        key={product.id}
        taxonomy={taxonomy}
        product={product}
        variant={variant}
        onQuickView={id => {
          setQuickViewId(id)
          setNotice('')
        }}
        onAdd={addProduct}
      />
    )

    return (
      <>
        {isCollectionRoot && (
          <section className="collection-hero">
            <div className="collection-hero-copy">
              <p className="eyebrow">{activeShopperPath.eyebrow}</p>
              <h1>{activeShopperPath.name}</h1>
              <p>
                {activeShopperPath.heroIntro.map((part, index) =>
                  typeof part === 'string'
                    ? part
                    : <strong key={index} className="hero-hl">{part.hl}</strong>,
                )}
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#shop">Shop the range</a>
                <a className="button secondary" href="/#trade">Trade enquiries</a>
              </div>
            </div>
            <div className="collection-hero-video">
              {heroPlaying ? (
                <video
                  className="collection-hero-video__player"
                  playsInline
                  autoPlay
                  controls
                  onEnded={() => setHeroPlaying(false)}
                  src={activeShopperPath.heroVideo}
                />
              ) : heroPosterFailed ? (
                <div className="video-facade video-facade--static">
                  <img
                    className="video-facade__poster"
                    src={activeShopperPath.background}
                    alt=""
                  />
                  <span className="video-facade__play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                    </svg>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="video-facade"
                  onClick={() => setHeroPlaying(true)}
                  aria-label={`Play the ${activeShopperPath.shortName} film`}
                >
                  <img
                    className="video-facade__poster"
                    src={activeShopperPath.heroPoster}
                    alt=""
                    loading="lazy"
                    onError={() => setHeroPosterFailed(true)}
                  />
                  <span className="video-facade__play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </section>
        )}
        <section className="commerce-layout" id="shop">
          <div className={`shop-layout-head theme-${activeShopperPath?.theme || 'lamp'}`}>
            <div className="shop-layout-copy">
              <p className="eyebrow">{shopHeadingEyebrow}</p>
              {isCollectionRoot ? <h2>{shopHeadingTitle}</h2> : <h1>{shopHeadingTitle}</h1>}
              <p>{shopHeadingDescription}</p>
            </div>
            <div className="shop-layout-aside" aria-label="Shop highlights">
              <div className="shop-layout-stats">
                <span><strong>{visibleProducts.length}</strong> shown</span>
                <span><strong>{activeShopperPath ? activeShopperPath.shortName : taxonomy.navList.length}</strong> {activeShopperPath ? 'buyer path' : 'categories'}</span>
                <span><strong>Trade</strong> bulk supply</span>
              </div>
              <div className="shop-layout-rail" aria-label="Featured categories">
                {spotlightCategories.map(category => (
                  <Link
                    key={category.slug}
                    href={activeShopperPath ? taxonomy.collectionHref(activeShopperPath.slug, category.slug) : taxonomy.href(category.slug)}
                  >
                    <img src={category.image} alt="" loading="lazy" />
                    <span>{category.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
      <aside className="shop-sidebar" aria-label="Shop filters">
        <div className="sidebar-heading">
          <p className="eyebrow">{activeShopperPath ? activeShopperPath.shortName : 'Shop controls'}</p>
          <span>{visibleProducts.length} shown</span>
        </div>
        {activeShopperPath && (
          <div className={`path-context theme-${activeShopperPath.theme}`}>
            <strong>{activeShopperPath.name}</strong>
            <p>{activeShopperPath.description}</p>
            <Link href="/shop">View full shop</Link>
          </div>
        )}
        <label>
          Search products
          <input
            type="search"
            placeholder="Lamp, holder, lick, brick..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <label>
          Sort
          <select value={sort} onChange={event => setSort(event.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-low">Price low to high</option>
            <option value="price-high">Price high to low</option>
            <option value="name">Name</option>
          </select>
        </label>
        <div className="filter-list" aria-label={isCollectionRoot ? 'Collection sections' : 'Product categories'}>
          <Link
            href={activeShopperPath ? `/collection/${activeShopperPath.slug}` : '/shop'}
            className={`${categoryFilter === 'all' && (!isCollectionRoot || activeCollectionSection === 'all') ? 'active' : ''} theme-${activeShopperPath?.theme || 'lamp'}`}
          >
            <span>{activeShopperPath ? `All ${activeShopperPath.shortName}` : 'All products'}</span>
            <small>{collectionProducts.length}</small>
          </Link>
          {isCollectionRoot ? (
            collectionSections.map(section => (
              <a
                key={section.id || section.title}
                href={`#${section.id || 'collection-products'}`}
                className={`${activeCollectionSection === section.id ? 'active' : ''} theme-${section.theme || activeShopperPath.theme}`}
                onClick={() => setActiveCollectionSection(section.id || 'all')}
              >
                <span>{section.title}</span>
                <small>{section.count}</small>
              </a>
            ))
          ) : (
            sidebarCategories.filter(category => !category.is_virtual).map(category => (
              <Link
                key={category.slug}
                href={activeShopperPath ? taxonomy.collectionHref(activeShopperPath.slug, category.slug) : taxonomy.href(category.slug)}
                className={`${categoryFilter === category.slug ? 'active' : ''} theme-${taxonomy.themeOf(category.slug)}`}
              >
                <span>{category.name}</span>
                <small>
                  {collectionProducts.filter(product => product.categories.includes(category.slug)).length}
                </small>
              </Link>
            ))
          )}
        </div>
      </aside>
      <div className="shop-main">
        {!isCollectionRoot && (
          <nav className="shop-mobile-jump" aria-label="Quick category links">
            <Link href="/shop" className={categoryFilter === 'all' ? 'active' : ''}>All</Link>
            {sidebarCategories.filter(category => !category.is_virtual).map(category => (
              <Link
                key={category.slug}
                href={activeShopperPath ? taxonomy.collectionHref(activeShopperPath.slug, category.slug) : taxonomy.href(category.slug)}
                className={categoryFilter === category.slug ? 'active' : ''}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        )}
        {isCollectionRoot && !collectionSections.length ? (
          /* A collection can legitimately have nothing in it — the Aura panels are
             hidden until they are priced. Without this the page simply stopped after
             the filter rail, with no explanation. Same three states as the shop grid
             below, so an outage never reads as "this range is empty". */
          <div className="product-grid">
            {catalog.status === 'loading' ? (
              <div className="empty-state">
                <h3>Loading the range…</h3>
                <p>One moment while we fetch the latest products and stock.</p>
              </div>
            ) : catalog.status === 'error' ? (
              <div className="empty-state">
                <h3>We can’t load this range right now</h3>
                <p>This is a problem at our end, not with your search. Please try again in a moment.</p>
                <button className="button secondary" type="button" onClick={loadCatalog}>Try again</button>
              </div>
            ) : (
              <div className="empty-state">
                <h3>Nothing in this range just yet</h3>
                <p>These products are on their way. In the meantime, the rest of the Salty Lamps range is ready to browse.</p>
                <Link className="button secondary" href="/shop">View all products</Link>
              </div>
            )}
          </div>
        ) : isCollectionRoot ? (
          <>
            <nav className="collection-path-cards" aria-label={`Shop ${activeShopperPath.name} by need`}>
              {collectionSections.map(section => (
                <a className="collection-path-card" href={`#${section.id || 'collection-products'}`} key={section.id || section.title}>
                  {section.image && <img src={section.image} alt="" loading="lazy" />}
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.count} shown</small>
                  </span>
                  {section.cardText && <p>{section.cardText}</p>}
                </a>
              ))}
            </nav>
            <div className="shop-sections">
              {collectionSections.map(section => (
                <section className={`shop-section theme-${section.theme || activeShopperPath.theme}`} id={section.id || undefined} key={section.title || 'all'}>
                  {section.title && (
                    <div className="shop-section-head">
                      <h3>
                        {section.title} <span>{section.count}</span>
                      </h3>
                      {section.descriptor && <p>{section.descriptor}</p>}
                    </div>
                  )}
                  <div className="shop-section-layout">
                    <aside className="shop-section-guide">
                      {section.image && <img src={section.image} alt="" loading="lazy" />}
                      <div>
                        <p className="eyebrow">Recommended route</p>
                        <strong>{section.cardText}</strong>
                        {section.recommendation && <p>{section.recommendation}</p>}
                      </div>
                      {section.categorySlug && (
                        <Link
                          className="shop-section-link"
                          href={taxonomy.collectionHref(activeShopperPath.slug, section.categorySlug)}
                        >
                          View only {section.title}
                        </Link>
                      )}
                    </aside>
                    <div className="shop-section-products">
                      {section.groups.map((group, index) => (
                        <div className="shop-subgroup" key={group.label || index}>
                          {group.label && <p className="shop-subgroup-label">{group.label}</p>}
                          <div className={`product-grid product-grid--section${group.products.length <= 2 ? ' product-grid--compact' : ''}`}>
                            {group.products.map(product => renderCard(product))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
            <CollectionTradeCta path={activeShopperPath} content={content} />
          </>
        ) : (
          <div className="product-grid">
            {catalog.status === 'loading' ? (
              <div className="empty-state">
                <h3>Loading the range…</h3>
                <p>One moment while we fetch the latest products and stock.</p>
              </div>
            ) : catalog.status === 'error' ? (
              /* Distinct from "no results" on purpose. This used to render the
                 search message below, so during an outage the shop told customers
                 they had searched wrong. */
              <div className="empty-state">
                <h3>We can’t load the shop right now</h3>
                <p>This is a problem at our end, not with your search. Please try again in a moment.</p>
                <button className="button secondary" type="button" onClick={loadCatalog}>Try again</button>
              </div>
            ) : visibleProducts.length ? (
              visibleProducts.map(renderCard)
            ) : (
              <div className="empty-state">
                <h3>No matching products</h3>
                <p>Try another search term or return to the full product range.</p>
                <Link className="button secondary" href="/shop">View all products</Link>
              </div>
            )}
          </div>
        )}
      </div>
        </section>
      </>
    )
  }

  const renderHome = () => (
    <>
      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">UK Himalayan salt products</p>
          <h1>Warm salt glow for homes, gifts, kitchens, spas, and trade projects.</h1>
          <p>
            Shop lamps, candle holders, saltware, salt bricks, accessories, and equestrian salt licks from Salty Lamps Ltd in Stoke-on-Trent.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/shop">Shop the full range</Link>
            <a className="button secondary" href="#trade">Request trade pricing</a>
          </div>
          <div className="hero-stats" aria-label="Store highlights">
            <span><strong>{products.length}</strong> products</span>
            <span><strong>Trade</strong> bulk orders</span>
            <span><strong>UK</strong> supplier</span>
          </div>
        </div>
        <div className="hero-video" aria-label="Salty Lamps product film">
          {homeHeroPlaying ? (
            <video
              playsInline
              autoPlay
              controls
              preload="metadata"
              onEnded={() => setHomeHeroPlaying(false)}
              poster="/media/video/salty-lamps-homepage-hero-poster-16x9.jpg"
            >
              <source src="/media/video/salty-lamps-homepage-hero-16x9.mp4" type="video/mp4" />
            </video>
          ) : homeHeroPosterFailed ? (
            <button
              type="button"
              className="video-facade video-facade--fallback"
              onClick={() => setHomeHeroPlaying(true)}
              aria-label="Play the Salty Lamps product film"
            >
              <span className="video-facade__play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="video-facade"
              onClick={() => setHomeHeroPlaying(true)}
              aria-label="Play the Salty Lamps product film"
            >
              <img
                className="video-facade__poster"
                src="/media/video/salty-lamps-homepage-hero-poster-16x9.jpg"
                alt=""
                loading="eager"
                onError={() => setHomeHeroPosterFailed(true)}
              />
              <span className="video-facade__play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="shopper-paths" aria-label="Shop by buyer type">
        <div className="shopper-paths-heading">
          <p className="eyebrow">Shop by what you need</p>
          <h2>Choose the range that fits your buyer journey.</h2>
        </div>
        {collections.map(path => (
          <Link key={path.slug} href={`/collection/${path.slug}`} className={`shopper-card theme-${path.theme}`}>
            <img className="shopper-card-bg" src={path.background} alt="" loading="lazy" />
            <span className="shopper-card-copy">
              <span>{path.eyebrow}</span>
              <strong>{path.name}</strong>
              <small>{path.description}</small>
            </span>
          </Link>
        ))}
      </section>


      <section className="trade-panel" id="trade">
        <div className="trade-copy">
          <p className="eyebrow">Trade and wholesale</p>
          <h2>Salt walls, bricks, licks, retail stock, and repeat supply.</h2>
          <p>
            Salty Lamps supports shops, spas, wellness rooms, butchers, equestrian suppliers, hospitality buyers, and interiors projects with product advice and bulk-order routes.
          </p>
          <div className="trade-media">
            <img src={media('trade-wholesale-showroom-generated.png')} alt="Trade showroom display with Himalayan salt walls, lamps, packaged stock, salt licks, and spa products" loading="lazy" />
            <span>Salt walls</span>
            <span>Retail stock</span>
            <span>Equestrian licks</span>
            <span>Spa supply</span>
          </div>
        </div>
        <form
          className="contact-card"
          onSubmit={handleTradeSubmit}
        >
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            What do you need?
            <select name="interest" defaultValue="">
              <option value=""></option>
              <option>Salt wall or bricks</option>
              <option>Retail lamps and holders</option>
              <option>Equestrian salt licks</option>
              <option>Kitchen and pantry stock</option>
            </select>
          </label>
          <label>
            Message
            {/* Required here because /api/support/enquiry requires it for a trade
                enquiry. This form reports success in a `finally`, so a rejected
                submission would otherwise say "Thanks for submitting" and drop the
                lead — client and server have to agree on the rule, not just the
                endpoint know it. */}
            <textarea name="message" rows="4" required />
          </label>
          <Honeypot />
          <button type="submit">Send trade enquiry</button>
          {formMessage && <p className="success">{formMessage}</p>}
        </form>
      </section>

      <section className="reviews-band" id="reviews">
        <div className="review-summary-card">
          <div className="review-summary-copy">
            <p className="eyebrow">Customer proof</p>
            <h2>Warm light, helpful service, and natural products people can inspect.</h2>
            <p>
              Based on {reviewCount} customer guestbook notes, with the strongest themes surfaced from the real wording customers left after buying.
            </p>
          </div>
          <div className="review-score">
            <strong>{snippet(content, 'reviews.headline_score', '')}</strong>
            <span>
              <span className="review-stars" aria-label="5 star featured reviews">★★★★★</span>
              <small>Featured guestbook rating</small>
            </span>
          </div>
          <div className="review-signals" aria-label="Common customer review themes">
            {reviewSignals.map(signal => (
              <div className="review-signal" key={signal.label}>
                <span>{signal.label}</span>
                <small>{signal.count} mentions</small>
                <i aria-hidden="true">
                  <b style={{ '--review-signal': `${signal.percent}%` }} />
                </i>
              </div>
            ))}
          </div>
          <div className="review-trust-row" aria-label="Review trust markers">
            <Link className="review-cta" href="/reviews">
              <svg width="38" height="38" viewBox="0 0 40 40" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <polygon points="20,4 24.1,14.3 35.2,15.1 26.7,22.2 29.4,33 20,27 10.6,33 13.3,22.2 4.8,15.1 15.9,14.3" />
              </svg>
              Read all {reviewCount} reviews
            </Link>
          </div>
        </div>
        <div className="featured-reviews">
          {featuredReviews.map(review => (
            <article className="featured-review" key={review.id}>
              <div className="review-card-header">
                <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
                <span>
                  <strong>{review.name}</strong>
                  <small>{review.date}</small>
                </span>
              </div>
              <div className="review-rating-row">
                <strong className="review-stars" aria-label="5 star review">★★★★★</strong>
                <span>5.0</span>
                <em>Verified</em>
              </div>
              <p>{review.quote}</p>
              <small className="review-proof">{review.proof}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  )

  const renderProductPage = product => {
    const theme = taxonomy.themeForProduct(product)
    const detailImages = detailImagesFor(content, product, theme)
    const reassurance = productReassurance(content, theme)
    const proof = productProof(content, theme)
    const selling = productSellingContent(content, taxonomy, product)
    const visibleReviews = productVisibleReviews(content, theme)
    const eyebrow = product.tags.join(' / ')

    return (
      <section className={`product-page theme-${theme}`}>
        <div className="product-gallery">
          <div className="product-gallery-main">
            <img src={product.image} alt={product.name} />
            <span>{selling.category}</span>
          </div>
          <div className="product-gallery-thumbs">
            {detailImages.map(item => (
              <img key={item.src} src={item.src} alt={item.alt} />
            ))}
          </div>
        </div>
        <div className="product-detail">
          <div className="product-buy-panel">
            {/* No product has tags yet, and an empty eyebrow still reserves its
                bottom margin — so render it only when there is something in it. */}
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1>{product.name}</h1>
            <p className="product-lede">{selling.lede}</p>
            <div className="detail-meta">
              <strong>{priceLabel(product)}</strong>
              <span>{product.stock ? 'In stock' : 'Out of stock'}</span>
              {product.sku && <span>SKU {product.sku}</span>}
              {product.stock && product.stockQty != null && product.stockQty <= 5 && (
                <span>Only {product.stockQty} left</span>
              )}
            </div>
            {notice && (quickViewId === product.id || currentProduct?.id === product.id) && <p className="notice">{notice}</p>}
            <div className="hero-actions product-cta-row">
              <button className="button primary" type="button" onClick={() => addProduct(product)} disabled={!product.stock}>
                Add to cart
              </button>
              <a className="button secondary" href={contactMailto(content, product.name)}>
                Ask a question
              </a>
            </div>
            <div className="product-proof-strip">
              <span className="review-stars" aria-label="5 star customer proof">★★★★★</span>
              <p>{proof.quote}</p>
              <small>{proof.name} · {proof.proof}</small>
            </div>
          </div>

          <div className="product-selling-grid">
            <article>
              <span>{selling.useTitle}</span>
              <ul>
                {selling.uses.map(item => <li key={item}>{item}</li>)}
              </ul>
            </article>
            <article>
              <span>{selling.careTitle}</span>
              <ul>
                {selling.care.map(item => <li key={item}>{item}</li>)}
              </ul>
            </article>
            <article>
              <span>Why it is worth choosing</span>
              <p>{selling.promise}</p>
            </article>
          </div>

          <div className="product-info-panel">
            <article>
              <span>Product details</span>
              <p>{product.description} Natural Himalayan salt varies in colour, texture, and weight, so the product you receive will have its own tone and surface character.</p>
            </article>
            <article>
              <span>Buyer reassurance</span>
              <p>{reassurance.join(' ')}</p>
            </article>
            <article>
              <span>Delivery and support</span>
              <p>Contact Salty Lamps Ltd for order support, bulk enquiries, returns questions, and replacement bulbs or cables. If you are unsure about size, fitting, or trade quantities, ask before placing the order request.</p>
            </article>
          </div>

          <div className="product-review-panel" aria-label="Visible customer reviews">
            <div className="product-review-heading">
              <div>
                <p className="eyebrow">Customer proof</p>
                <h2>Real buyer notes before you add to cart.</h2>
              </div>
              <Link className="text-link" href="/reviews">Read all {reviewCount} reviews</Link>
            </div>
            <div className="product-review-grid">
              {visibleReviews.map(review => (
                <article key={`${product.id}-${review.name}-${review.date}`}>
                  <div className="review-card-header">
                    <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
                    <span>
                      <strong>{review.name}</strong>
                      <small>{review.date}</small>
                    </span>
                  </div>
                  <p className="review-stars-line" aria-label="5 star review">★★★★★</p>
                  <p>{review.quote}</p>
                  <em>{review.proof}</em>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  const renderGallery = () => {
    const [featuredGalleryItem, ...supportingGalleryItems] = galleryShowcaseItems

    return (
      <section className="gallery-page gallery-page--showcase">
        <div className="section-heading gallery-heading">
          <p className="eyebrow">Gallery</p>
          <h1>Product details, lifestyle scenes, and trade-use references.</h1>
          <p>Browse the range as a visual showcase, from finished room settings to close-up salt textures.</p>
        </div>

        <div className="gallery-showcase">
          <Link className="gallery-feature-card" href={featuredGalleryItem.href}>
            <img src={featuredGalleryItem.image} alt={featuredGalleryItem.title} />
            <span>{featuredGalleryItem.label}</span>
            <div>
              <h2>{featuredGalleryItem.title}</h2>
              <p>{featuredGalleryItem.body}</p>
            </div>
          </Link>

          <div className="gallery-story-stack" aria-label="Gallery themes">
            {supportingGalleryItems.map(item => (
              <Link className="gallery-story-card" key={item.key} href={item.href}>
                <img src={item.image} alt={item.title} loading="lazy" />
                <span>{item.label}</span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="gallery-section-heading">
          <div>
            <p className="eyebrow">Product close-ups</p>
            <h2>Shapes, finishes, and natural salt character.</h2>
          </div>
          <Link className="text-link" href="/shop">Shop the full range</Link>
        </div>

        <div className="gallery-grid gallery-mosaic">
          {galleryItems.map(item => (
            <Link className={`gallery-card ${item.variant ? `gallery-card--${item.variant}` : ''}`} key={item.key} href={item.href}>
              <img src={item.image} alt={item.name} loading="lazy" />
              <span>{item.label}</span>
              <strong>{item.name}</strong>
            </Link>
          ))}
        </div>
      </section>
    )
  }

  const renderPolicy = currentPage => (
    <section className="policy-page">
      <p className="eyebrow">Salty Lamps Ltd</p>
      <h1>{currentPage.title}</h1>
      {currentPage.body.map(paragraph => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <Link className="button secondary" href="/shop">Return to shop</Link>
    </section>
  )

  const renderReturnPolicy = () => (
    <section className="policy-page return-page">
      <p className="eyebrow">Returns and exchanges</p>
      <h1>Simple returns, clear next steps.</h1>
      <p>
        If you are not completely satisfied with your purchase, Salty Lamps can review a return for a refund or exchange when the item meets the policy conditions.
      </p>
      <div className="policy-highlights">
        <article>
          <span>14 days</span>
          <strong>Return window</strong>
          <p>Returns must be postmarked within fourteen days of the purchase date.</p>
        </article>
        <article>
          <span>Unused</span>
          <strong>Original condition</strong>
          <p>Returned items should be new, unused, and sent back with original tags, labels, and packaging.</p>
        </article>
        <article>
          <span>RMA</span>
          <strong>Email before sending</strong>
          <p>Email {contactEmailOf(content)} first so customer service can issue a return authorisation number.</p>
        </article>
      </div>
      <div className="policy-steps">
        <h2>How to return an item</h2>
        <ol>
          <li>Email customer service to request a Return Merchandise Authorization number.</li>
          <li>Place the item securely in its original packaging with proof of purchase.</li>
          <li>Mail the return to Salty Lamps Ltd, Unit 41, Imex Business Park, Ormonde Street, Stoke-on-Trent, ST4 3NP.</li>
          <li>Allow at least three days after receipt for the return or exchange to be processed.</li>
        </ol>
      </div>
      <div className="policy-note">
        <strong>Opened salt bags and pouches cannot be returned.</strong>
        <p>For defective or damaged products, contact Salty Lamps so the team can arrange a refund or exchange.</p>
      </div>
      <div className="hero-actions">
        {/* The form route rather than a mailto: it captures the order reference and
            verifies it against the order book before anyone is emailed, which a
            free-text mail cannot. The mailto stays as the secondary path. */}
        <Link className="button primary" href="/refund-request">Start a return</Link>
        <a className="button secondary" href="tel:+441782970001">Call 01782 970001</a>
      </div>
    </section>
  )

  const renderProcessPage = () => (
    <section className="process-page">
      <div className="process-hero">
        <div className="process-hero-copy">
          <p className="eyebrow">How it is made</p>
          <h1>From mined rock salt to finished lamps, bricks, bowls, and tiles.</h1>
          <p>
            The Salty Lamps manufacturing route follows the material from mine extraction through sorting, cutting, hand-finishing, packaging, palletizing, and export.
          </p>
        </div>
        <div className="process-visual" aria-label="Manufacturing process visual">
          {(content.lists?.['process-steps'] || []).map((step, index) => (
            <span key={step.title}>
              <strong>{index + 1}</strong>
              {step.label}
            </span>
          ))}
        </div>
      </div>
      <div className="process-film" aria-label="Manufacturing process video">
        {processFilmPlaying ? (
          <video
            playsInline
            autoPlay
            controls
            preload="metadata"
            onEnded={() => setProcessFilmPlaying(false)}
            poster="/media/video/salty-lamps-manufacturing-process-poster-16x9.jpg"
          >
            <source src="/media/video/salty-lamps-manufacturing-process-16x9.mp4" type="video/mp4" />
          </video>
        ) : processFilmPosterFailed ? (
          <button
            type="button"
            className="video-facade video-facade--fallback"
            onClick={() => setProcessFilmPlaying(true)}
            aria-label="Play the Salty Lamps manufacturing process film"
          >
            <span className="video-facade__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="video-facade"
            onClick={() => setProcessFilmPlaying(true)}
            aria-label="Play the Salty Lamps manufacturing process film"
          >
            <img
              className="video-facade__poster"
              src="/media/video/salty-lamps-manufacturing-process-poster-16x9.jpg"
              alt=""
              loading="eager"
              onError={() => setProcessFilmPosterFailed(true)}
            />
            <span className="video-facade__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <div className="process-about" aria-label="About Salty Lamps products">
        <div className="process-about-copy">
          <p className="eyebrow">About Salty Lamps</p>
          <h2>One natural material, shaped for homes, kitchens, spas, trade buyers, and animals.</h2>
          <p>
            Salty Lamps Ltd manufactures high-quality Himalayan crystal rock salt products with care, from raw material selection through shaping, finishing, packing, and supply. The range is broad, but the promise stays simple: natural salt products that feel warm, useful, sustainable, and made with attention.
          </p>
        </div>
        <div className="process-range-grid">
          {(content.lists?.['process-product-ranges'] || []).map(item => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="process-proof" aria-label="What the manufacturing film shows">
        {(content.lists?.['process-proof-points'] || []).map(point => (
          <article key={point.title}>
            <span>{point.label}</span>
            <h2>{point.title}</h2>
            <p>{point.text}</p>
          </article>
        ))}
      </div>
    </section>
  )

  const renderReviewsPage = () => (
    <section className="reviews-page">
      <header className="reviews-page-hero">
        <div>
          <p className="eyebrow">Guestbook feedback</p>
          <h1>Real customer notes from the Salty Lamps guestbook.</h1>
          <p>Every note is left by a verified buyer through the post-purchase guestbook. Start with the strongest themes, then browse a representative set of real customer wording.</p>
        </div>
        <div className="reviews-page-score">
          <strong>{snippet(content, 'reviews.headline_score', '')}</strong>
          <span className="review-stars" aria-hidden="true">★★★★★</span>
          <small>{reviewCount} verified reviews</small>
        </div>
      </header>
      <div className="review-theme-grid" aria-label="Customer review themes">
        {reviewSignals.map(signal => (
          <article key={signal.label}>
            <span>{signal.count}</span>
            <strong>{signal.label}</strong>
            <p>{signal.percent}% of guestbook notes mention this theme.</p>
          </article>
        ))}
      </div>
      <div className="review-feature-grid" aria-label="Featured customer proof">
        {featuredReviews.map(review => (
          <article key={review.id}>
            <div className="review-card-header">
              <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
              <span>
                <strong>{review.name}</strong>
                <small>{review.date}</small>
              </span>
            </div>
            <p className="review-stars-line" aria-label="5 star review">★★★★★</p>
            <p>{review.quote}</p>
            <em>{review.proof}</em>
          </article>
        ))}
      </div>
      <div className="reviews-list-heading">
        <div>
          <p className="eyebrow">Representative guestbook notes</p>
          <h2>Recent proof without the endless scroll.</h2>
        </div>
        <p>Showing {Math.min(36, corpus.length)} of {reviewCount} verified notes. The full archive can stay available behind a “load more” control when the live site needs it.</p>
      </div>
      <div className="reviews-grid">
        {corpus.slice(0, 36).map(review => (
          <article key={review.id}>
            <div className="review-card-header">
              <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
              <span>
                <strong>{review.name}</strong>
                <small>{review.date}</small>
              </span>
            </div>
            <p className="review-stars-line" aria-label="5 star review">★★★★★</p>
            <p>{review.quote}</p>
            <em>Verified buyer</em>
          </article>
        ))}
      </div>
    </section>
  )

  const renderCheckoutSuccess = () => (
    <section className="policy-page checkout-status-page">
      <p className="eyebrow">Order confirmed</p>
      <h1>Thank you — your order is confirmed.</h1>
      <p>
        Payment was successful and a confirmation email is on its way. Salty Lamps will get your order packed and shipped shortly.
      </p>
      <div className="hero-actions">
        <Link className="button primary" href="/shop">Continue shopping</Link>
        <a className="button secondary" href={contactMailto(content)}>Contact us about this order</a>
      </div>
    </section>
  )

  const renderCheckoutCancelled = () => (
    <section className="policy-page checkout-status-page">
      <p className="eyebrow">Checkout cancelled</p>
      <h1>Your order was not placed.</h1>
      <p>
        No payment was taken. Your cart is still here if you would like to try again.
      </p>
      <div className="hero-actions">
        <Link className="button primary" href="/shop">Return to shop</Link>
        <a className="button secondary" href={contactMailto(content)}>Contact us</a>
      </div>
    </section>
  )

  const handleRefundSubmit = async event => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setRefund({ status: 'sending', errors: {} })

    try {
      const res = await fetch('/api/support/refund-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          order_ref: data.get('order_ref'),
          email: data.get('email'),
          reason: data.get('reason'),
          website: data.get('website'),
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRefund({ status: 'idle', errors: payload?.error?.fields || { form: payload?.error?.message || 'Something went wrong. Please try again.' } })
        return
      }
      setRefund({ status: 'sent', errors: {} })
      form.reset()
    } catch {
      setRefund({ status: 'idle', errors: { form: `Could not reach us just now. Please try again, or email ${contactEmailOf(content)}.` } })
    }
  }

  const renderRefundRequest = () => (
    <section className="policy-page checkout-status-page">
      <p className="eyebrow">Returns and refunds</p>
      <h1>Request a refund or return.</h1>
      {refund.status === 'sent' ? (
        <>
          {/* Deliberately non-committal. The endpoint answers identically whether or
              not the reference and email matched an order, so that a stranger cannot
              use this form to discover whether an order exists. Promising "we have
              your request" here would leak exactly what that hides. */}
          <p>
            Thank you. If those details match an order, our team has been notified and will be in touch by
            email within two working days. If you do not hear from us, check the order reference against your
            confirmation email, or write to us directly.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/shop">Back to shop</Link>
            <a className="button secondary" href={contactMailto(content)}>Email us instead</a>
          </div>
        </>
      ) : (
        <>
          <p>
            Tell us which order and what went wrong. Use the order reference from your confirmation email —
            it looks like <strong>#A1B2C3D4</strong> — and the email address you ordered with.
          </p>
          <form className="contact-card" onSubmit={handleRefundSubmit}>
            <label>
              Order reference
              <input name="order_ref" type="text" placeholder="#A1B2C3D4" required />
            </label>
            {refund.errors.order_ref && <p className="notice">{refund.errors.order_ref}</p>}
            <label>
              Email you ordered with
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {refund.errors.email && <p className="notice">{refund.errors.email}</p>}
            <label>
              What is wrong?
              <textarea name="reason" rows="5" placeholder="Tell us what happened and what you would like us to do." required />
            </label>
            {refund.errors.reason && <p className="notice">{refund.errors.reason}</p>}
            <Honeypot />
            <button type="submit" disabled={refund.status === 'sending'}>
              {refund.status === 'sending' ? 'Sending…' : 'Send request'}
            </button>
            {refund.errors.form && <p className="notice">{refund.errors.form}</p>}
          </form>
        </>
      )}
    </section>
  )

  const renderNotFound = () => (
    <section className="policy-page not-found-page">
      <p className="eyebrow">{notFoundCopyOf(content).eyebrow}</p>
      <h1>{notFoundCopyOf(content).title}</h1>
      <p>{notFoundCopyOf(content).description}</p>
      <div className="hero-actions">
        <Link className="button primary" href="/shop">Shop the range</Link>
        <Link className="button secondary" href="/">Return home</Link>
      </div>
    </section>
  )

  // The admin portal is a self-contained, auth-gated subtree with its own chrome
  // (sidebar + topbar) — render it instead of the storefront shell. Placed after
  // all hooks so React's rules-of-hooks hold.
  if (route.startsWith('/admin')) {
    return <AdminApp route={route} />
  }

  return (
    <div className="site-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className="announce">Bulk and trade orders available</div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Salty Lamps home">
          {/* The emblem is a square JPEG on a solid black field. No transparent
              variant is needed: .brand img already clips it with border-radius:50%
              and object-fit:cover, so only black corner is removed, and the
              existing amber box-shadow reads as the lamp's glow. */}
          <img src="/salty-lamp-logo.jpeg" alt="" />
          <span>Salty Lamps</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/">Home</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/gallery">Gallery</Link>
          <a href="/#trade">Trade</a>
          <Link href="/admin">Admin</Link>
          <a href={contactMailto(content)}>Contact</a>
          <Link className="nav-about" href="/process">About</Link>
        </nav>
        <button className="cart-button" type="button" onClick={() => setCartOpen(true)}>
          Cart <span>{cartCount}</span>
        </button>
      </header>

      <main id="main">
        {notFound
          ? renderNotFound()
          : currentProduct
          ? renderProductPage(currentProduct)
          : route === '/checkout/success'
            ? renderCheckoutSuccess()
          : route === '/checkout/cancelled'
            ? renderCheckoutCancelled()
          : route === '/refund-request'
            ? renderRefundRequest()
          : route === '/process'
            ? renderProcessPage()
            : route === '/reviews'
              ? renderReviewsPage()
              : route === '/returns-exchanges' || route === '/return-refund-policy'
                ? renderReturnPolicy()
          : page
            ? renderPolicy(page)
            : route === '/gallery'
              ? renderGallery()
              : route === '/shop' || categorySlug || activeShopperPath
                ? renderShop()
                : renderHome()}
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="footer-eyebrow">Primary manufacturer &amp; processor</span>
          <strong>Salty Lamps Ltd</strong>
          <ul className="footer-contact">
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Unit 41, Imex Business Park, Ormonde Street, Stoke-on-Trent, ST4 3NP</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
              <a href={contactMailto(content)}>{contactEmailOf(content)}</a>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
              </svg>
              <a href="tel:+441782970001">01782 970001</a>
            </li>
          </ul>
        </div>
        <form
          className="newsletter"
          onSubmit={handleNewsletterSubmit}
        >
          <label>
            <span className="footer-eyebrow">Newsletter</span>
            <span className="newsletter-field">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
              <input name="email" type="email" placeholder="Email address" required />
            </span>
          </label>
          <Honeypot />
          <button type="submit">Subscribe</button>
          {newsletterMessage && <span className="newsletter-message">{newsletterMessage}</span>}
        </form>
        <nav aria-label="Footer links">
          <span className="footer-eyebrow">Company</span>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-and-conditions">Terms and Conditions</Link>
          <Link className="footer-link-accent" href="/return-refund-policy">Returns and Exchanges</Link>
          <Link href="/process">Manufacturing Process</Link>
        </nav>
      </footer>

      <ChatModule onSubmit={handleChatSubmit} message={chatMessage} content={content} />

      <aside
        className={`cart-drawer ${cartOpen ? 'open' : ''}`}
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
        inert={cartOpen ? undefined : ''}
      >
        <header>
          <div>
            <p className="eyebrow">Your cart</p>
            <h2>{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Ready when you are'}</h2>
          </div>
          <button type="button" onClick={() => setCartOpen(false)}>Close</button>
        </header>
        <div className="cart-lines">
          {cart.length ? cart.map(item => (
            <article className="cart-line" key={item.key}>
              <img src={item.product.image} alt="" />
              <div>
                <strong>{item.product.name}</strong>
                <small>{money(item.product.price)}</small>
              </div>
              <div className="qty">
                <button type="button" onClick={() => changeQty(item.key, -1)} aria-label={`Decrease ${item.product.name}`}>-</button>
                <span>{item.qty}</span>
                <button type="button" onClick={() => changeQty(item.key, 1)} aria-label={`Increase ${item.product.name}`}>+</button>
              </div>
            </article>
          )) : <p>Your selected products will appear here.</p>}
        </div>
        <footer>
          {notice && <p className="notice">{notice}</p>}
          <span>Subtotal</span>
          <strong>{money(cartTotal)}</strong>
          {cart.length ? (
            <button
              type="button"
              className="button primary"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Redirecting…' : 'Checkout'}
            </button>
          ) : (
            <Link className="button secondary" href="/shop" onClick={() => setCartOpen(false)}>
              Continue shopping
            </Link>
          )}
        </footer>
      </aside>
      {cartOpen && <button className="scrim" type="button" aria-label="Close cart" onClick={() => setCartOpen(false)} />}

      {quickViewProduct && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="quick-view-title">
          <button className="scrim" type="button" aria-label="Close quick view" onClick={() => setQuickViewId(null)} />
          <div className="quick-view">
            <button className="close-button" type="button" onClick={() => setQuickViewId(null)}>Close</button>
            <img src={quickViewProduct.image} alt={quickViewProduct.name} />
            <div>
              {quickViewProduct.tags.length > 0 && <p className="eyebrow">{quickViewProduct.tags.join(' / ')}</p>}
              <h2 id="quick-view-title">{quickViewProduct.name}</h2>
              <p>{quickViewProduct.description}</p>
              <strong>{priceLabel(quickViewProduct)}</strong>
              {notice && quickViewId === quickViewProduct.id && <p className="notice">{notice}</p>}
              <div className="hero-actions">
                <button className="button primary" type="button" onClick={() => addProduct(quickViewProduct)} disabled={!quickViewProduct.stock}>
                  Add to cart
                </button>
                <Link className="button secondary" href={`/product-page/${quickViewProduct.slug}`} onClick={() => setQuickViewId(null)}>
                  Full details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
