import React from 'react'

const TRAFFIC_TIMELINE = [
  {
    period: 'Month 1–2',
    traffic: 'Near zero',
    driver: 'Google indexing',
    actions: 'GBP verified, sitemap submitted',
  },
  {
    period: 'Month 3–4',
    traffic: '50–150',
    driver: 'B2B long-tail keywords',
    actions: 'First trade enquiries from organic',
  },
  {
    period: 'Month 5–6',
    traffic: '200–500',
    driver: 'Blog articles ranking',
    actions: 'Email list 100+ subscribers',
  },
  {
    period: 'Month 7–9',
    traffic: '500–1,500',
    driver: 'Tier 2 keywords + social',
    actions: 'Reviews visible in search',
  },
  {
    period: 'Month 10–12',
    traffic: '1,500–4,000',
    driver: 'Content compounds',
    actions: 'Tier 1 appearing in top 20',
  },
  {
    period: 'Year 2+',
    traffic: '5,000–15,000',
    driver: 'Authority builds',
    actions: 'Self-sustaining organic growth',
  },
]

const BLOG_ARTICLES = [
  'Do salt lamps work?',
  'Salt walls buyer\'s guide (B2B)',
  'Lamp for sleep',
  'Himalayan vs table salt',
  'How we make lamps (E-E-A-T)',
  'Best lamp guide 2026',
]

export default function OrganicTraffic() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Organic Traffic — The Complete Strategy</h2>
        <p className="sub">
          No paid ads. Growth from four compounding channels: content, social, email, backlinks.
          Each feeds the others.
        </p>
      </div>

      <div className="cta-box green">
        <p>
          <strong>Organic-only is the right call.</strong> A well-written article about
          &ldquo;salt walls for spas UK&rdquo; will rank #1 within 60 days and send free trade
          enquiries forever. That same article gets shared on Pinterest, goes into the email
          newsletter, and attracts a backlink from a spa industry directory. One piece of
          content works across four channels simultaneously — no ad budget required.
        </p>
      </div>

      <div className="afeature-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 28 }}>
        {[
          { icon: '✍️', title: 'Content & Blog', desc: '12 articles/year targeting ranked keywords' },
          { icon: '📧', title: 'Email (42:1 ROI)', desc: 'Welcome, abandoned cart, post-purchase' },
          { icon: '📸', title: 'Instagram & Pinterest', desc: '3 posts/wk + 5 pins/wk, Reels strategy' },
          { icon: '🔗', title: 'Backlink Building', desc: 'Trade directories, press, guest posts' },
        ].map(item => (
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

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Traffic growth timeline (monthly visits)
      </h4>

      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table className="sl-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Est. Traffic</th>
              <th>Primary Driver</th>
              <th>Key Actions / Milestones</th>
            </tr>
          </thead>
          <tbody>
            {TRAFFIC_TIMELINE.map((row) => (
              <tr key={row.period}>
                <td style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, color: '#b86040' }}>
                  {row.period}
                </td>
                <td>
                  <strong>{row.traffic}</strong>
                </td>
                <td>{row.driver}</td>
                <td>{row.actions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
