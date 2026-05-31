import React from 'react'

const TREE_TEXT = `salty-lamps/
├── public/              favicon  sitemap.xml  robots.txt  og-home.jpg
├── src/
│   ├── assets/          images/  videos/  icons/
│   ├── components/
│   │   ├── ui/          button  badge  card  modal  drawer  offer-badge
│   │   ├── layout/      header  footer  nav  sidebar
│   │   ├── product/     product-card  gallery  price-display  bundle-pricing-panel
│   │   ├── cart/        cart-drawer  cart-item  cart-summary  express-checkout
│   │   ├── seo/         json-ld-product  json-ld-article  json-ld-org  meta-tags
│   │   └── forms/       contact-form  trade-enquiry  newsletter  review-request
│   ├── pages/
│   │   ├── shop/        index  salt-lamps  candle-holders  platters-bowls
│   │   │                culinary-salt  bath-salts  animal-licks  spa-walls
│   │   ├── trade/       index  spas  butchers  equestrian  apply
│   │   ├── about/       our-story  manufacturing  sustainability
│   │   ├── journal/     index  [slug]
│   │   └── home.jsx  contact.jsx  search.jsx  not-found.jsx
│   ├── hooks/           use-cart  use-wishlist  use-search  use-currency
│   ├── context/         cart-context  auth-context  currency-context
│   ├── lib/             commerce.js  sanity.js  analytics.js  schema.js
│   └── styles/          globals.css  tokens.css
├── data/                customer-reviews.json  marketing-research.json
└── tests/               Playwright e2e`

const SITEMAP_BRANCHES = [
  {
    node: '/',
    label: 'Home',
    children: ['Video hero', 'Bestsellers', 'Health benefits', 'Reviews', 'B2B callout', 'Newsletter'],
  },
  {
    node: '/shop',
    label: 'Shop',
    children: ['/salt-lamps', '/candle-holders', '/platters-bowls', '/culinary-salt', '/bath-salts', '/animal-licks', '/spa-walls', '/special-offers'],
  },
  {
    node: '/trade',
    label: 'Trade',
    children: ['/overview', '/spas', '/butchers', '/equestrian', '/apply', '/price-list (gated)'],
  },
  {
    node: '/about',
    label: 'About',
    children: ['/our-story', '/manufacturing', '/sustainability'],
  },
  {
    node: '/journal',
    label: 'Journal',
    children: ['/(index)', '/[slug]', 'Health & wellness', 'Interior styling', 'Trade insights'],
  },
  {
    node: '/contact',
    label: 'Contact',
    children: ['Contact form', 'Map (Stoke-on-Trent)', 'Trade enquiry'],
  },
]

const SITEMAP_BOTTOM = ['/cart', '/checkout', '/account', '/search', '/policies/returns', '/policies/privacy', '/404']

export default function SitemapStructure() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Sitemap, Folder Structure &amp; Naming Rules</h2>
        <p className="sub">
          Every page has a job and a target keyword. Folder naming is strict kebab-case
          throughout — no exceptions.
        </p>
      </div>

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Visual sitemap
      </h4>

      <div className="sitemap-wrap">
        <div className="sitemap-root">
          <div className="sitemap-node">saltylamps.co.uk</div>
          <div className="sitemap-connector" />
          <div className="sitemap-branches">
            {SITEMAP_BRANCHES.map((branch) => (
              <div key={branch.node} className="sitemap-branch">
                <div className="sitemap-node" style={{ minWidth: 110 }}>
                  <div style={{ fontWeight: 600 }}>{branch.node}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{branch.label}</div>
                </div>
                <div className="sitemap-connector" />
                <div className="sitemap-branch-children">
                  {branch.children.map((child) => (
                    <div key={child} className="sitemap-node sub">{child}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="sitemap-connector" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {SITEMAP_BOTTOM.map((page) => (
              <div key={page} className="sitemap-node sub">{page}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="bor" />

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Naming convention rules
      </h4>

      <div className="two-col" style={{ marginBottom: 28 }}>
        <div className="naming-do">
          <h5>&#10003; Do</h5>
          <code>src/components/product-card/</code>
          <code>src/pages/shop/salt-lamps.jsx</code>
          <code>src/hooks/use-cart.js</code>
          <code>src/assets/images/lamp-natural-pink.webp</code>
          <code>src/styles/tokens/color-salt.css</code>
        </div>
        <div className="naming-dont">
          <h5>&#10007; Don&rsquo;t</h5>
          <code>ProductCard.jsx (PascalCase filename)</code>
          <code>SALT_LAMPS / SRC (uppercase folders)</code>
          <code>saltLamps.jsx (camelCase)</code>
          <code>img1.jpg (non-descriptive)</code>
          <code>Salty Lamps Page.jsx (spaces)</code>
        </div>
      </div>

      <div className="bor" />

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 12 }}>
        Full folder structure
      </h4>

      <div className="tree-box">{TREE_TEXT}</div>
    </div>
  )
}
