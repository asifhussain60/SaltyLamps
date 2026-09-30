// The readable page a crawler receives before any JavaScript runs.
//
// WHY THIS EXISTS. Every built page used to be an empty shell: the visible body said
// "Loading your page…" and the product name, price and description appeared only after
// the app ran. Google runs JavaScript, but later and less reliably; Bing, ChatGPT,
// Perplexity and social-link scrapers mostly do not. So the shop's words were invisible
// to most of the places that send shoppers.
//
// This module turns the same facts the app renders (name, price, stock, description,
// links) into plain semantic HTML that the build writes into #root. React's createRoot
// replaces it on load, so it is never hydrated and cannot mismatch.
//
// The rule that keeps this honest: everything here is the page's own content, taken from
// the same snapshot the app renders. Nothing is added for crawlers that a shopper
// cannot also read, which is what separates this from cloaking.
//
// Pure on purpose — no imports, no environment — so it is unit-testable and cannot
// drift from its callers.

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const pounds = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0))

const tidy = value => String(value ?? '').replace(/\s+/g, ' ').trim()

// Hero copy arrives as strings and { hl } highlight fragments; a crawler wants the words.
export function flattenRichText(parts) {
  if (typeof parts === 'string') return tidy(parts)
  if (!Array.isArray(parts)) return ''
  return tidy(parts.map(part => (typeof part === 'string' ? part : part?.hl || '')).join(''))
}

const list = (items, render) => (items.length ? `<ul>${items.map(item => `<li>${render(item)}</li>`).join('')}</ul>` : '')

// One layout for every page type.
//   crumbs    [{ name, href }]  shown as a trail above the heading
//   heading   the page's one <h1>
//   lead      first paragraph
//   paragraphs  further paragraphs
//   image     { src, alt }
//   sections  [{ title, items?, text? }] headed blocks: a bullet list and/or a paragraph
//   facts     [[label, value]] rendered as a definition list
//   products  [{ name, href, price, stock }] rendered as a linked list
//   links     [{ name, href }] related pages
export function staticBody({ crumbs = [], heading, lead = '', paragraphs = [], sections = [], image = null, facts = [], productsHeading = 'Products', products = [], linksHeading = 'Explore', links = [] }) {
  const trail = crumbs.length
    ? `<nav aria-label="Breadcrumb">${crumbs.map(crumb => `<a href="${esc(crumb.href)}">${esc(crumb.name)}</a>`).join(' › ')}</nav>`
    : ''
  const figure = image?.src ? `<img src="${esc(image.src)}" alt="${esc(image.alt)}" style="max-width:100%;height:auto">` : ''
  const factList = facts.length
    ? `<dl>${facts.map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>`
    : ''
  const productList = products.length
    ? `<h2>${esc(productsHeading)}</h2>${list(products, p => `<a href="${esc(p.href)}">${esc(p.name)}</a> — ${esc(pounds(p.price))}${p.stock === false ? ' (out of stock)' : ''}`)}`
    : ''
  const blocks = sections
    .filter(section => section.title && (section.text || section.items?.length))
    .map(section => `<h2>${esc(section.title)}</h2>${section.text ? `<p>${esc(section.text)}</p>` : ''}${list(section.items || [], item => esc(item))}`)
    .join('')
  const related = links.length
    ? `<h2>${esc(linksHeading)}</h2>${list(links, link => `<a href="${esc(link.href)}">${esc(link.name)}</a>`)}`
    : ''
  return `<main class="seo-static" style="max-width:60rem;margin:0 auto;padding:1.5rem;font:16px/1.6 system-ui,sans-serif;color:#252525">${trail}<h1>${esc(heading)}</h1>${figure}${lead ? `<p>${esc(lead)}</p>` : ''}${paragraphs.filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}${factList}${blocks}${productList}${related}</main>`
}

export function productFacts(product) {
  return [
    ['Price', pounds(product.price)],
    ['Availability', product.stock ? 'Available to order' : 'Currently out of stock'],
    ...(product.sku ? [['Product code', product.sku]] : []),
  ]
}

// Where the body goes. The startup panel is the JavaScript-failure recovery message;
// it is kept, but hidden until it is needed, and its heading becomes a paragraph so the
// page keeps exactly one <h1>.
export function withStaticBody(html, body) {
  const panel = /<section id="startup-status"([^>]*)>\s*<h1([^>]*)>([^<]*)<\/h1>/
  let out = html.replace(panel, '<section id="startup-status" hidden$1>\n      <p$2>$3</p>')
  out = out.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
  return out
}

// The shop's one public address. A build that emits anything else into a sitemap,
// canonical, share card or structured data would point search engines at the private
// test shop or the admin, so the build asserts this instead of trusting a variable.
export const PRODUCTION_HOST = 'www.saltylamps.co.uk'
export const FORBIDDEN_HOST = /(?:^|[/.@"'\s])(?:test|admin|staging)\.saltylamps\.co\.uk|\.pages\.dev|localhost|127\.0\.0\.1/i

export function assertProductionAddress(siteUrl, files) {
  if (new URL(siteUrl).host !== PRODUCTION_HOST) {
    throw new Error(`siteUrl is ${siteUrl}; search engines must be pointed at https://${PRODUCTION_HOST}.`)
  }
  const offenders = files.filter(file => FORBIDDEN_HOST.test(file.text)).map(file => file.name)
  if (offenders.length) {
    throw new Error(
      `${offenders.length} generated SEO file(s) mention a private address (test, admin, staging, pages.dev or localhost):\n`
      + offenders.slice(0, 10).map(name => `    ${name}`).join('\n')
      + `\n  Every canonical, sitemap entry, share card and structured-data URL must use https://${PRODUCTION_HOST}.`,
    )
  }
}
