import React from 'react'
import DonutChart from '../DonutChart.jsx'

const SCORES = [
  { label: 'Visual Design & Brand',      pct: 15, cls: 'fill-lo' },
  { label: 'Mobile Responsiveness',       pct: 25, cls: 'fill-lo' },
  { label: 'SEO & Discoverability',       pct: 10, cls: 'fill-lo' },
  { label: 'Content & Storytelling',      pct:  5, cls: 'fill-lo' },
  { label: 'Trust & Social Proof *',      pct: 40, cls: 'fill-md' },
  { label: 'E-commerce UX',               pct: 35, cls: 'fill-md' },
  { label: 'Promotional Pricing',         pct:  0, cls: 'fill-lo' },
  { label: 'B2B / Trade Portal',          pct:  0, cls: 'fill-lo' },
]

const ROOT_CAUSES = [
  {
    num: 1,
    cause: 'Zero indexable content',
    badge: 'badge-red', badgeLabel: 'Fatal',
    fix: '12+ pages, dedicated URLs, blog with 12 articles/year',
  },
  {
    num: 2,
    cause: '"Himalayan" typo in every meta tag',
    badge: 'badge-red', badgeLabel: 'Fatal',
    fix: 'Corrected throughout, unique meta per page targeting real search terms',
  },
  {
    num: 3,
    cause: 'Wix performance penalty. Lighthouse 30–50, LCP >2.5s = -23% traffic',
    badge: 'badge-red', badgeLabel: 'Critical',
    fix: 'React + Vite on Cloudflare Pages. Target Lighthouse ≥90, LCP <2.5s',
  },
  {
    num: 4,
    cause: 'Zero backlinks',
    badge: 'badge-red', badgeLabel: 'Critical',
    fix: 'Manufacturing story as linkable asset. Trade directories. Blog attracts natural links',
  },
  {
    num: 5,
    cause: 'No Google Business Profile',
    badge: 'badge-red', badgeLabel: 'Critical',
    fix: 'GBP created and verified Week 1 — before any code written',
  },
  {
    num: 6,
    cause: 'Meta keywords: "Quality, Home, Goods." Nobody searches these',
    badge: 'badge-amber', badgeLabel: 'High',
    fix: 'Targeted keyword strategy per page',
  },
  {
    num: 7,
    cause: 'No structured data',
    badge: 'badge-amber', badgeLabel: 'High',
    fix: 'JSON-LD on every page: Product, AggregateRating, Organization, FAQPage, Article',
  },
  {
    num: 8,
    cause: 'Social links go to Wix, not the brand',
    badge: 'badge-amber', badgeLabel: 'Medium',
    fix: 'Fix immediately. Instagram and Pinterest prioritised',
  },
  {
    num: 9,
    cause: 'Homepage causes instant bounce. No hero, no emotional hook',
    badge: 'badge-amber', badgeLabel: 'High',
    fix: 'Ambient video hero, 3-click path, trust signals. Target <35% bounce',
  },
  {
    num: 10,
    cause: 'No E-E-A-T signals',
    badge: 'badge-amber', badgeLabel: 'Medium',
    fix: 'Manufacturing story page, real reviews, About team, expert blog',
  },
]

export default function HonestAudit() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Why the Site Gets Zero Traffic</h2>
        <p className="sub">
          A direct, honest diagnosis. Understanding exact root causes is the only way to fix them.
        </p>
      </div>

      <div className="cta-box red" style={{ marginBottom: 28 }}>
        <p>
          <strong>The core problem:</strong> saltylamps.co.uk is effectively invisible to Google —
          no content to rank, no authority signals, no technical SEO, and a homepage that gives
          visitors no reason to stay. It is not a site with a traffic problem. It is a site that
          has not been built for traffic.
        </p>
      </div>

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Current health scores
      </h4>

      <div className="donut-grid">
        {SCORES.map((s) => (
          <DonutChart key={s.label} pct={s.pct} label={s.label} color={s.cls === 'fill-hi' ? 'hi' : s.cls === 'fill-md' ? 'md' : 'lo'} size={150} />
        ))}
      </div>
      <p className="text-muted-sm" style={{ marginTop: -16, marginBottom: 28 }}>
        * Reviews exist but not deployed. Requires GDPR consent before display.
      </p>

      <div className="bor" />

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        The 10 root causes — ranked by impact
      </h4>

      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table className="sl-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Root Cause</th>
              <th>Impact</th>
              <th>Fix in new site</th>
            </tr>
          </thead>
          <tbody>
            {ROOT_CAUSES.map((row) => (
              <tr key={row.num}>
                <td style={{ fontFamily: 'Oswald, sans-serif', color: '#b86040', fontWeight: 600 }}>
                  {row.num}
                </td>
                <td>{row.cause}</td>
                <td>
                  <span className={`badge-custom ${row.badge}`}>{row.badgeLabel}</span>
                </td>
                <td>{row.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bor" />

      <div className="two-col">
        <div className="service-card">
          <div className="card-label">Problem deep-dive</div>
          <h4>The bounce problem</h4>
          <p>
            A visitor arriving from Google sees no hero image, no tagline, no product photography,
            no price — just a logo and a navigation bar. With no emotional hook and no clear
            next action, the average dwell time is under 5 seconds. Google interprets this as
            "the result was not useful" and drops the ranking further. The bounce rate compounds
            invisibility: less traffic, lower ranking, even less traffic.
          </p>
        </div>
        <div className="service-card">
          <div className="card-label">What we keep &amp; amplify</div>
          <h4>Strengths to build from</h4>
          <ul>
            <li>Direct manufacturer — unbeatable supply chain story</li>
            <li>7 product categories across B2C and B2B</li>
            <li>Fast UK delivery (confirmed in 4/6 reviews)</li>
            <li>Healthcare professional endorsement on record</li>
            <li>B2B verticals: spas, butchers, equestrian, hospitality</li>
            <li>UK-based business — trust signal for local SEO</li>
            <li>Loyal repeat customers and gifting behaviour confirmed</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
