import React from 'react'

const TIERS = [
  {
    id: 'launch',
    label: 'Launch',
    range: 'Months 1–3',
    visits: '0 – 500 visits/mo',
    total: '£0 – £6 / mo',
    totalColor: '#27ae60',
    services: [
      { name: 'Cloudflare Pages', purpose: 'Hosting, CDN, SSL', cost: 'Free', note: 'Unlimited bandwidth, 500 builds/mo' },
      { name: 'Sanity CMS', purpose: 'Blog & product content editing', cost: 'Free', note: 'Up to 10k API calls/day, 2 users' },
      { name: 'Cloudinary', purpose: 'Image optimisation & delivery', cost: 'Free', note: '25 GB storage, 25 GB bandwidth' },
      { name: 'GA4 + Search Console', purpose: 'Analytics & ranking data', cost: 'Free', note: 'Google — always free' },
      { name: 'Email (Mailchimp)', purpose: 'Welcome & newsletter flows', cost: 'Free', note: 'Up to 500 contacts, 1k sends/mo' },
      { name: 'Domain (saltylamps.co.uk)', purpose: 'Already owned', cost: '~£1/mo', note: 'Amortised annual renewal' },
      { name: 'Commerce engine', purpose: 'Cart, checkout, offers', cost: 'TBD', note: 'See decision below' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    range: 'Months 4–12',
    visits: '500 – 4,000 visits/mo',
    total: '£30 – £60 / mo',
    totalColor: '#e67e22',
    services: [
      { name: 'Cloudflare Pages', purpose: 'Hosting, CDN, SSL', cost: 'Free', note: 'Still within free tier' },
      { name: 'Sanity CMS', purpose: 'Blog & product content', cost: 'Free', note: 'Free tier handles this volume' },
      { name: 'Cloudinary', purpose: 'Image delivery', cost: 'Free', note: 'Free tier unless >100 product images' },
      { name: 'Email (Klaviyo)', purpose: '~1,000 contacts', cost: '~£20/mo', note: 'Upgrades from Mailchimp at this scale' },
      { name: 'Commerce engine', purpose: 'Cart, checkout, B2B pricing', cost: '£5–£29/mo', note: 'See decision below' },
      { name: 'Domain', purpose: 'Already owned', cost: '~£1/mo', note: '' },
    ],
  },
  {
    id: 'scale',
    label: 'Scale',
    range: 'Year 2+',
    visits: '4,000 – 15,000 visits/mo',
    total: '£100 – £160 / mo',
    totalColor: '#b86040',
    services: [
      { name: 'Cloudflare Pages', purpose: 'Hosting, CDN, SSL', cost: 'Free', note: 'Paid plan only if >500 builds/mo' },
      { name: 'Sanity CMS', purpose: 'Blog & product content', cost: 'Free – £83/mo', note: 'Growth plan only if team exceeds 3 users' },
      { name: 'Cloudinary', purpose: 'Image delivery at volume', cost: '£0 – £44/mo', note: 'Paid if bandwidth exceeds 25 GB' },
      { name: 'Email (Klaviyo)', purpose: '~5,000 contacts', cost: '~£70/mo', note: 'Scales with list size — biggest cost driver' },
      { name: 'Commerce engine', purpose: 'Full store', cost: '£29–£79/mo', note: 'See decision below' },
      { name: 'Domain', purpose: 'Already owned', cost: '~£1/mo', note: '' },
    ],
  },
]

const COMMERCE = [
  {
    option: 'Shopify Starter',
    monthly: '$5 / mo',
    badge: 'badge-green',
    bestFor: 'Quick launch, low volume',
    tradeoff: '2.5% transaction fee on every sale. Fine under ~50 orders/mo, then switch to Basic.',
    rec: false,
  },
  {
    option: 'Shopify Basic',
    monthly: '$29 / mo',
    badge: 'badge-amber',
    bestFor: 'Growing B2C store',
    tradeoff: '2% fee unless using Shopify Payments (not available UK-wide for all banks). Best all-round option.',
    rec: true,
  },
  {
    option: 'WooCommerce (headless)',
    monthly: '£5–10 hosting',
    badge: 'badge-blue',
    bestFor: 'Full control, no transaction fees',
    tradeoff: 'You manage the WordPress install, plugins, and updates. No transaction fees. More dev work to connect to React frontend.',
    rec: false,
  },
  {
    option: 'Shopify Headless (Hydrogen)',
    monthly: '$29+ / mo',
    badge: 'badge-red',
    bestFor: 'Custom React storefront at scale',
    tradeoff: 'Overkill for launch. Consider only if B2B portal needs complex custom pricing rules that Shopify Basic can\'t handle natively.',
    rec: false,
  },
]

const COST_DRIVERS = [
  {
    driver: 'Email list growth',
    impact: 'Highest',
    detail: 'Klaviyo charges by contact count. At 500 contacts: free. At 1k: ~£20. At 5k: ~£70. At 10k: ~£130. Start on Mailchimp, migrate to Klaviyo at 500+ contacts.',
    badge: 'badge-red',
  },
  {
    driver: 'Image CDN (Cloudinary)',
    impact: 'Medium',
    detail: 'Free until 25 GB bandwidth. A catalogue of 50–80 products with WebP images stays within free tier easily. Only becomes paid if you run a high-traffic gift guide season.',
    badge: 'badge-amber',
  },
  {
    driver: 'Transaction fees',
    impact: 'Medium',
    detail: 'On Shopify Starter (2.5%) a £5,000/mo revenue month costs £125 in fees. At that point, upgrade to Basic (2%) or switch to WooCommerce (0%).',
    badge: 'badge-amber',
  },
  {
    driver: 'Sanity CMS users',
    impact: 'Low',
    detail: 'Free tier supports 2 users. If a VA or copywriter needs CMS access, Growth plan is £83/mo. Until then, share one account.',
    badge: 'badge-green',
  },
  {
    driver: 'Cloudflare Pages builds',
    impact: 'Low',
    detail: '500 builds/month on free tier. At one deploy per day you use 30. You\'d need to be deploying 17× per day to hit the limit. Effectively free forever.',
    badge: 'badge-green',
  },
]

export default function Pricing() {
  const [activeTier, setActiveTier] = React.useState('launch')

  const tier = TIERS.find(t => t.id === activeTier)

  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Running Costs</h2>
        <p className="sub">
          Development cost: £0 — you're building it. The only recurring spend is third-party
          services, which start free and scale only with site traffic and list growth.
        </p>
      </div>

      {/* Dev cost callout */}
      <div className="cta-box green" style={{ marginBottom: 28 }}>
        <p>
          <strong>Development &amp; maintenance: £0.</strong> As the developer, your time is not
          a line item. Ongoing code changes, deployments, and feature additions cost nothing
          beyond your time. This is a significant structural advantage over hiring an agency
          (typically £3,000–£8,000 for a project of this scope).
        </p>
      </div>

      {/* Tier selector */}
      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Hosting &amp; services — by growth stage
      </h4>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TIERS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTier(t.id)}
            style={{
              padding: '8px 20px',
              borderRadius: 4,
              border: `2px solid ${activeTier === t.id ? t.totalColor : '#e0d0c6'}`,
              background: activeTier === t.id ? t.totalColor : '#fff',
              color: activeTier === t.id ? '#fff' : '#555',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '1rem',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label} — {t.range}
          </button>
        ))}
      </div>

      {/* Active tier detail */}
      <div style={{
        background: '#fff',
        border: `2px solid ${tier.totalColor}`,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 28,
      }}>
        <div style={{
          background: tier.totalColor,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.375rem', color: '#fff', letterSpacing: '0.06em' }}>
              {tier.label} Stage · {tier.visits}
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
              {tier.range}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.625rem', fontWeight: 700, color: '#fff' }}>
              {tier.total}
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)' }}>
              estimated total
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="sl-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Service</th>
                <th>Purpose</th>
                <th>Monthly cost</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {tier.services.map((row) => (
                <tr key={row.name}>
                  <td style={{ fontWeight: 500, color: '#2a1a0e' }}>{row.name}</td>
                  <td>{row.purpose}</td>
                  <td>
                    <span style={{
                      fontFamily: 'Oswald, sans-serif',
                      fontWeight: 600,
                      color: row.cost === 'Free' ? '#27ae60' : row.cost === 'TBD' ? '#888' : '#b86040',
                    }}>
                      {row.cost}
                    </span>
                  </td>
                  <td className="table-sub">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bor" />

      {/* Commerce engine decision */}
      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', margin: '20px 0 16px' }}>
        Commerce engine — pick one before Phase 1
      </h4>

      <div className="cta-box" style={{ marginBottom: 20 }}>
        <p>
          <strong>This is the one decision that must be made before any build work starts.</strong>{' '}
          It determines the cart API, B2B discount rules, product data model, and checkout flow.
          Deferring it past Week 1 delays everything downstream.
        </p>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table className="sl-table">
          <thead>
            <tr>
              <th>Option</th>
              <th>Monthly</th>
              <th>Best for</th>
              <th>Trade-off</th>
            </tr>
          </thead>
          <tbody>
            {COMMERCE.map(row => (
              <tr key={row.option} className={row.rec ? 'highlight' : ''}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: row.rec ? 600 : 400 }}>{row.option}</span>
                    {row.rec && <span className="badge-custom badge-green">Recommended</span>}
                  </div>
                </td>
                <td style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, color: '#b86040' }}>
                  {row.monthly}
                </td>
                <td>{row.bestFor}</td>
                <td style={{ fontSize: '0.95rem', color: '#666' }}>{row.tradeoff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bor" />

      {/* Cost drivers */}
      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', margin: '20px 0 16px' }}>
        What drives costs up — and when to act
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {COST_DRIVERS.map(item => (
          <div key={item.driver} style={{
            display: 'flex',
            gap: 16,
            background: '#fff',
            border: '1px solid #e0d0c6',
            borderRadius: 6,
            padding: '14px 18px',
            alignItems: 'flex-start',
          }}>
            <div style={{ flexShrink: 0, paddingTop: 2 }}>
              <span className={`badge-custom ${item.badge}`}>{item.impact}</span>
            </div>
            <div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, fontSize: '1.05rem', color: '#2a1a0e', marginBottom: 4 }}>
                {item.driver}
              </div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#666', lineHeight: 1.6 }}>
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Annual summary band */}
      <div className="summary-band">
        <h3>Cost at a Glance</h3>
        <p>All estimates. Dev cost is £0. Only third-party services scale with usage.</p>
        <div className="summary-stats">
          {[
            { num: '£0', label: 'Dev & maintenance' },
            { num: '£0–6', label: 'Launch / month' },
            { num: '£30–60', label: 'Growth / month' },
            { num: '£100–160', label: 'Scale / month' },
          ].map(s => (
            <div key={s.label} className="summary-stat">
              <span className="stat-num">{s.num}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
