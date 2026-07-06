import React from 'react'

const CONFIRMED_AFEATURE = [
  { icon: '✅', title: 'B2C Primary', desc: 'B2B portal as secondary channel' },
  { icon: '🎨', title: 'Warm & Earthy', desc: 'Clay, terracotta, deep brown brand' },
  { icon: '🌱', title: 'Organic Only', desc: 'Content + social + email + backlinks' },
  { icon: '👆', title: '3-Click Path', desc: 'Hero → Product → Checkout' },
  { icon: '🏷️', title: 'Promo Pricing', desc: 'B1G1 · B2G1 · B3G1 offer rules' },
  { icon: '⏳', title: 'Commerce TBD', desc: 'Shopify recommended — Phase 1 decision' },
]

const PHASES = [
  {
    id: 'p00',
    title: 'Phase 00 — SEO & GBP before code starts',
    weeks: 'Week 1',
    items: [
      { done: true,  text: 'Create and verify Google Business Profile (5–7 days)' },
      { done: true,  text: 'Fix "Himalayan" spelling in all Wix meta tags while still live' },
      { done: true,  text: 'Fix social footer links to point to real Salty Lamps accounts' },
      { done: false, text: 'Set up Google Search Console — submit Wix sitemap' },
      { done: false, text: 'Set up GA4 on current Wix site' },
      { done: false, text: 'Set up email platform (Klaviyo free tier)' },
    ],
  },
  {
    id: 'p01',
    title: 'Phase 01 — Foundation & Design System',
    weeks: 'Weeks 2–4',
    items: [
      { done: false, text: 'Brand identity: colour tokens, typography, logo refinement' },
      { done: false, text: 'Tailwind config with salt-brand design tokens' },
      { done: false, text: 'Component library: button, badge, card, offer-badge, modal, drawer' },
      { done: false, text: 'Header + footer + nav (all 4 breakpoints)' },
      { done: false, text: 'Vite + React + React Router scaffold' },
      { done: true,  text: 'Commerce engine finalised (Shopify vs WooCommerce)' },
      { done: false, text: 'Cloudflare Pages CI/CD + preview branch deploys' },
      { done: false, text: 'schema.js utility — JSON-LD for all page types' },
    ],
  },
  {
    id: 'p02',
    title: 'Phase 02 — Core Shop — Site Goes Live',
    weeks: 'Weeks 5–9',
    items: [
      { done: true,  text: 'Homepage: video hero, 3-click CTA, bestsellers, reviews, B2B strip, newsletter' },
      { done: false, text: 'Shop index + 8 collection pages + /special-offers' },
      { done: false, text: 'Product detail: gallery, bundle pricing, offer badges, JSON-LD' },
      { done: true,  text: 'Promotional pricing rules: B1G1 · B2G1 · B3G1 — cart logic + product badges' },
      { done: false, text: 'Cart drawer + express checkout (Apple Pay / Google Pay)' },
      { done: false, text: 'Upload all product photos to Cloudinary' },
      { done: false, text: 'Deploy 5 customer reviews (send GDPR consent emails first)' },
      { done: true,  text: 'DNS migration → Cloudflare Pages. Site goes live. Submit sitemap immediately.' },
    ],
  },
  {
    id: 'p03',
    title: 'Phase 03 — Content, Trade Portal & Authority',
    weeks: 'Weeks 10–15',
    items: [
      { done: false, text: 'Sanity CMS connected + Journal/blog live' },
      { done: true,  text: 'First 3 blog articles (Tier 3 B2B keywords — fastest ranking)' },
      { done: false, text: 'Trade portal: spas, butchers, equestrian + enquiry form' },
      { done: false, text: 'About + Manufacturing story page (mine → Karachi → UK timeline)' },
      { done: false, text: 'Updated returns + privacy policies (UK Consumer Rights Act 2015)' },
      { done: false, text: 'FAQPage schema on all relevant pages' },
      { done: false, text: '5+ trade directory submissions (backlinks)' },
      { done: false, text: 'Instagram + Pinterest: first 12 posts' },
    ],
  },
  {
    id: 'p04',
    title: 'Phase 04 — Internationalisation & Polish',
    weeks: 'Weeks 16–20',
    items: [
      { done: false, text: 'EUR + USD currency switching' },
      { done: false, text: 'EU VAT handling' },
      { done: false, text: 'hreflang tags (UK / EU / US)' },
      { done: false, text: 'Lighthouse audit ≥90 all key pages' },
      { done: false, text: 'WCAG AA accessibility pass' },
    ],
  },
]

export default function BuildPlan() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Build Plan &amp; Next Steps</h2>
        <p className="sub">
          Five phases over twenty weeks. SEO work starts Week 1 before any code. The site goes
          live in Phase 2 and organic traffic compounds immediately.
        </p>
      </div>

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Confirmed decisions
      </h4>

      <div className="afeature-grid afeature-grid-3col" style={{ marginBottom: 28 }}>
        {CONFIRMED_AFEATURE.map(item => (
          <div key={item.title} className="afeature-wrap">
            <div className="afeature">
              <div className="afmatter">
                <span className="af-icon" style={{ fontSize: 30 }}>{item.icon}</span>
                <h5>{item.title}</h5>
                <p>{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bor" />

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 20 }}>
        Build timeline
      </h4>

      <div className="timeline">
        {PHASES.map((phase) => (
          <div key={phase.id} className="phase">
            <h5>
              {phase.title}
              <span
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontWeight: 400,
                  fontSize: '0.78rem',
                  color: '#b86040',
                  marginLeft: 10,
                }}
              >
                {phase.weeks}
              </span>
            </h5>
            <ul className="phase-list">
              {phase.items.map((item) => (
                <li key={item.text} className={item.done ? 'done' : ''}>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="summary-band">
        <h3>Ready to Start</h3>
        <p>
          Phase 00 begins this week — no code required. GBP takes 5–7 days to verify.
        </p>
        <div className="summary-stats">
          <div className="summary-stat">
            <span className="stat-num">20</span>
            <span className="stat-label">Weeks · Full Build</span>
          </div>
          <div className="summary-stat">
            <span className="stat-num">£0–£119</span>
            <span className="stat-label">Running Costs /mo</span>
          </div>
          <div className="summary-stat">
            <span className="stat-num">5</span>
            <span className="stat-label">Phases · Clear Milestones</span>
          </div>
          <div className="summary-stat">
            <span className="stat-num">Organic</span>
            <span className="stat-label">Only · No Ad Spend</span>
          </div>
        </div>
      </div>
    </div>
  )
}
