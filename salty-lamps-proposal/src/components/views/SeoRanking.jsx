import React from 'react'
import DonutChart from '../DonutChart.jsx'

const FUNNEL = [
  {
    cls: 'fl-1',
    title: 'Level 1 — Can Google find & crawl it?',
    detail: 'Sitemap · robots.txt · fast load · no broken pages',
  },
  {
    cls: 'fl-2',
    title: 'Level 2 — Does it match search intent?',
    detail: 'Keyword relevance · content depth · structured data · unique URLs',
  },
  {
    cls: 'fl-3',
    title: "Level 3 — Does Google trust it?",
    detail: 'E-E-A-T · backlinks · GBP · reviews · real business signals',
  },
  {
    cls: 'fl-4',
    title: 'Level 4 — Do users actually like it?',
    detail: 'Dwell time · scroll depth · return visits · low bounce · Core Web Vitals',
  },
]

const CURRENT_SCORES = [
  { label: 'Crawlability', pct: 40, cls: 'fill-md' },
  { label: 'Relevance',    pct:  5, cls: 'fill-lo' },
  { label: 'Trust',        pct:  3, cls: 'fill-lo' },
  { label: 'UX',           pct: 10, cls: 'fill-lo' },
]

const NEW_SCORES = [
  { label: 'Crawlability', pct: 95, cls: 'fill-hi' },
  { label: 'Relevance',    pct: 85, cls: 'fill-hi' },
  { label: 'Trust',        pct: 55, cls: 'fill-md' },
  { label: 'UX',           pct: 90, cls: 'fill-hi' },
]

const KW_LEFT = [
  {
    tier: 'Tier 1 — Hard (12–24 months)',
    kws: [
      { term: 'himalayan salt lamp uk', intent: 'Buy' },
      { term: 'salt lamp', intent: 'Info' },
      { term: 'himalayan bath salts uk', intent: 'Buy' },
    ],
  },
  {
    tier: 'Tier 2 — Medium (3–9 months)',
    kws: [
      { term: 'himalayan rock salt lamp', intent: 'Buy' },
      { term: 'salt candle holder uk', intent: 'Buy' },
      { term: 'himalayan culinary salt uk', intent: 'Buy' },
    ],
  },
]

const KW_RIGHT = [
  {
    tier: 'Tier 3 B2B — Very Low (1–4 months)',
    kws: [
      { term: 'salt walls for spas uk', intent: 'B2B' },
      { term: 'himalayan salt brick meat curing', intent: 'B2B' },
      { term: 'horse salt lick supplier uk', intent: 'B2B' },
    ],
  },
  {
    tier: 'Tier 4 — Long-tail content',
    kws: [
      { term: 'do himalayan salt lamps actually work', intent: 'Info' },
      { term: 'himalayan salt lamp for sleep uk', intent: 'Buy' },
      { term: 'culinary himalayan salt vs table salt', intent: 'Info' },
    ],
  },
]

const intentColor = {
  Buy:  'badge-green',
  Info: 'badge-blue',
  B2B:  'badge-amber',
}

export default function SeoRanking() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>How Google Ranks Sites &amp; What We&rsquo;re Doing About It</h2>
      </div>

      <div className="two-col" style={{ marginBottom: 28 }}>
        <div>
          <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
            Google&rsquo;s 4-level ranking hierarchy
          </h4>
          <div className="funnel-wrap">
            {FUNNEL.map((f) => (
              <div key={f.cls} className={`funnel-level ${f.cls}`}>
                <div className="fl-title">{f.title}</div>
                <div className="fl-detail">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 12 }}>
            Current Site
          </h4>
          <div className="donut-grid donut-grid-2col">
            {CURRENT_SCORES.map((s) => (
              <DonutChart key={s.label} pct={s.pct} label={s.label} color={s.cls === 'fill-hi' ? 'hi' : s.cls === 'fill-md' ? 'md' : 'lo'} size={140} />
            ))}
          </div>

          <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', margin: '20px 0 12px' }}>
            New Site Targets
          </h4>
          <div className="donut-grid donut-grid-2col">
            {NEW_SCORES.map((s) => (
              <DonutChart key={s.label} pct={s.pct} label={s.label} color={s.cls === 'fill-hi' ? 'hi' : s.cls === 'fill-md' ? 'md' : 'lo'} size={140} />
            ))}
          </div>
          <p className="text-muted-sm" style={{ marginTop: 8 }}>
            * Trust builds over 6–18 months through content and backlinks. Cannot be shortcut.
          </p>
        </div>
      </div>

      <div className="bor" />

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Keyword strategy
      </h4>

      <div className="two-col" style={{ marginBottom: 28 }}>
        <div>
          {KW_LEFT.map((tier) => (
            <div key={tier.tier} className="keyword-tier">
              <h5>{tier.tier}</h5>
              <ul>
                {tier.kws.map((kw) => (
                  <li key={kw.term}>
                    <span className={`badge-custom ${intentColor[kw.intent]}`}>{kw.intent}</span>
                    {kw.term}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div>
          {KW_RIGHT.map((tier) => (
            <div key={tier.tier} className="keyword-tier">
              <h5>{tier.tier}</h5>
              <ul>
                {tier.kws.map((kw) => (
                  <li key={kw.term}>
                    <span className={`badge-custom ${intentColor[kw.intent]}`}>{kw.intent}</span>
                    {kw.term}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bor" />

      <div className="three-col">
        <div className="service-card">
          <div className="card-label">Week 1 — Free win</div>
          <h4>Google Business Profile</h4>
          <p>
            Free to create. Takes 5–7 days to verify by postcard. The single fastest ranking
            improvement available — before any code is written. Enables local pack appearance
            for &ldquo;himalayan salt lamps near me&rdquo; searches.
          </p>
        </div>
        <div className="service-card">
          <div className="card-label">On every page</div>
          <h4>Structured Data</h4>
          <p>
            JSON-LD schema types: <code>Product</code>, <code>AggregateRating</code>,{' '}
            <code>Organization</code>, <code>FAQPage</code>, <code>Article</code>,{' '}
            <code>BreadcrumbList</code>. Enables rich results (stars, prices, FAQs) in search.
          </p>
        </div>
        <div className="service-card">
          <div className="card-label">From launch day</div>
          <h4>Core Web Vitals</h4>
          <p>
            Target: LCP &lt;2.5s &middot; INP &lt;200ms &middot; CLS &lt;0.1.
            React + Vite build + Cloudflare CDN delivers these scores from day one — not
            after months of optimisation.
          </p>
        </div>
      </div>
    </div>
  )
}
