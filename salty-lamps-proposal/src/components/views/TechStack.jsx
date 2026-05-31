import React from 'react'

const STACK = [
  { icon: '⚛️', title: 'React 18 + Vite', desc: 'Sub-2s loads, code-splitting, SEO-ready' },
  { icon: '🎨', title: 'Tailwind CSS v4', desc: 'Salt-brand tokens, purged CSS bundle' },
  { icon: '🛒', title: 'Commerce Engine', desc: 'Shopify or WooCommerce — TBD Phase 1' },
  { icon: '🔗', title: 'React Router v6', desc: 'SEO-friendly URLs, lazy-loaded routes' },
  { icon: '✏️', title: 'Sanity CMS', desc: 'Non-developer editable blog & products' },
  { icon: '🖼️', title: 'Cloudinary', desc: 'WebP auto, responsive images, lazy load' },
  { icon: '📋', title: 'JSON-LD Schema', desc: 'Rich snippets: Product, FAQ, Reviews' },
  { icon: '📊', title: 'GA4 + Search Console', desc: 'Track dwell, scroll depth, conversions' },
  { icon: '☁️', title: 'Cloudflare Pages', desc: 'Sub-50ms TTFB, global CDN, free tier' },
]

const COSTS = [
  { service: 'Cloudflare Pages', tier: 'Free tier', cost: '£0' },
  { service: 'Sanity CMS', tier: 'Growth', cost: '£0–£19' },
  { service: 'Cloudinary', tier: 'Free → Plus', cost: '£0–£15' },
  { service: 'Commerce engine', tier: 'TBD', cost: '£0–£65' },
  { service: 'Email (Klaviyo)', tier: 'Free → Starter', cost: '£0–£20' },
]

export default function TechStack() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Modern Tech Stack</h2>
        <p className="sub">
          Every choice justified by SEO performance, developer velocity, and long-term
          maintainability.
        </p>
      </div>

      <div className="cta-box">
        <p>
          <strong>Commerce engine TBD.</strong> Built behind a{' '}
          <code>src/lib/commerce.js</code> abstraction layer so the engine can be swapped
          without rewriting the UI. Critical requirement: must support automatic discount rules
          (Buy 1 Get 1 Half Price, Buy 2 Get 1 Free, Buy 3 Get 1 Free) natively — not as
          coupon codes.
        </p>
      </div>

      <div className="afeature-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 28 }}>
        {STACK.map(item => (
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

      <div className="two-col">
        <div>
          <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
            Estimated monthly running costs
          </h4>
          <table className="sl-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Tier</th>
                <th>Monthly</th>
              </tr>
            </thead>
            <tbody>
              {COSTS.map((row) => (
                <tr key={row.service}>
                  <td>{row.service}</td>
                  <td style={{ color: '#888', fontSize: '0.82rem' }}>{row.tier}</td>
                  <td>
                    <strong style={{ color: '#3a7d44' }}>{row.cost}</strong>
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#fdf8f5', fontWeight: 600 }}>
                <td colSpan={2}>New stack total</td>
                <td>
                  <strong style={{ color: '#b86040' }}>£0–£119/mo</strong>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ color: '#888' }}>Current platform (Wix Business)</td>
                <td style={{ color: '#c0392b' }}>~£15–£20/mo</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="service-card" style={{ alignSelf: 'start' }}>
          <div className="card-label">Platform comparison</div>
          <h4>Why not stay on Wix?</h4>
          <ul>
            <li>500–900kb JS bundle; Lighthouse 30–50</li>
            <li>LCP &gt;3.0s = -23% estimated traffic loss</li>
            <li>No custom code control — B2B portal is impossible</li>
            <li>Platform lock-in; cannot export data cleanly</li>
            <li>Discount rules not supported at required granularity</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
