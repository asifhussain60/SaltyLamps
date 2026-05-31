import React, { useState } from 'react'

// ─── Revenue Stream Data ───────────────────────────────────────────────────
const STREAMS = [
  {
    id: 'wholesale',
    title: 'Wholesale Trade Portal',
    icon: '🏪',
    aov: '£300–£800',
    effort: 'Medium',
    effortColor: '#e67e22',
    timeframe: '4–8 weeks',
    badge: 'Quick Win',
    badgeColor: '#27ae60',
    description: 'A password-protected B2B section on the website where spas, gift shops, and wellness retailers order at trade prices (typically 40–50% off RRP). MOQ per line item keeps admin low. UK independent gift and wellness retailers number over 8,000 — and none of your current four competitors run a self-serve trade portal.',
    action: 'Build a trade enquiry form now; upgrade to self-serve portal at 10+ trade accounts.',
  },
  {
    id: 'privatelabel',
    title: 'Private Label for Spas',
    icon: '🏷️',
    aov: '£500–£2,000',
    effort: 'Medium',
    effortColor: '#e67e22',
    timeframe: '6–10 weeks',
    badge: 'High Margin',
    badgeColor: '#b86040',
    description: 'Spas and halotherapy rooms rebrand your salt products with their own logo on packaging. You supply the product; they sell it at 2–3× the price to their clients. Typical order size: 24–100 units per SKU. Margin uplift over standard wholesale: 15–25%. Salt scrubs, bath salts, and small gift lamps are the highest-demand SKUs in this channel.',
    action: 'Create a "Private Label" enquiry page; target 5 UK spa groups in the first outreach campaign.',
  },
  {
    id: 'subscription',
    title: 'Subscription Salt Box',
    icon: '📬',
    aov: '£18–£35/mo',
    effort: 'High',
    effortColor: '#c0392b',
    timeframe: '10–16 weeks',
    badge: 'Recurring Revenue',
    badgeColor: '#2980b9',
    description: 'A curated monthly or quarterly box of Himalayan salt products — cooking slabs, bath salts, small lamps, recipe cards. The UK subscription box market exceeded £1.2bn in 2023 (Royal Mail Subscription Box Report). Wellness and food boxes are among the fastest-growing categories. A 200-subscriber base at £22/mo = £4,400 MRR with near-zero acquisition cost after launch.',
    action: 'Validate demand with a Typeform waitlist before building fulfilment. 50 sign-ups = green light.',
  },
  {
    id: 'halotherapy',
    title: 'Halotherapy Room Consulting',
    icon: '🧘',
    aov: '£1,500–£5,000',
    effort: 'High',
    effortColor: '#c0392b',
    timeframe: '8–12 weeks',
    badge: 'Premium',
    badgeColor: '#8f4a2e',
    description: 'Design and supply salt room installations for spas, yoga studios, and wellness hotels. A full salt room install uses 3–8 tonnes of Himalayan salt bricks and panels, which you source at direct-manufacturer cost. UK halotherapy room installations typically cost £8,000–£25,000 — the product cost is 25–40% of that. Consultancy fee + product margin in one project.',
    action: 'Create a "Salt Room Design" page with a project enquiry form; photograph any installation you supply.',
  },
  {
    id: 'amazon',
    title: 'Amazon FBA — Parallel Channel',
    icon: '📦',
    aov: '£14–£40',
    effort: 'Medium',
    effortColor: '#e67e22',
    timeframe: '4–8 weeks',
    badge: 'Volume Play',
    badgeColor: '#7f8c8d',
    description: 'Amazon UK is the primary discovery channel for Himalayan salt lamps — top-selling ASINs in the "Decorative Salt Lamps" subcategory move 200–500 units/month at £18–£35. Running FBA as a parallel channel captures buyers who won\'t visit your site directly. Margin after FBA fees (15% referral + fulfilment) is 30–40% on a £25 lamp. Keeps your website as the premium experience while Amazon handles volume.',
    action: 'List 3–5 core SKUs on FBA. Optimise listing with "Pakistan-mined" provenance copy to differentiate from Chinese sellers.',
  },
  {
    id: 'giftsets',
    title: 'Gift Sets & Seasonal Bundles',
    icon: '🎁',
    aov: '£35–£85',
    effort: 'Low',
    effortColor: '#27ae60',
    timeframe: '1–3 weeks',
    badge: 'Quick Win',
    badgeColor: '#27ae60',
    description: 'Bundling 2–3 products into a gift set increases AOV by 40–60% over individual items with minimal additional cost. Himalayan salt gift sets (lamp + bath salts + recipe slab) index heavily on Google and Pinterest at Christmas, Mother\'s Day, and Valentine\'s Day. No new inventory — just packaging and a dedicated landing page per occasion. The highest-ROI move in this list.',
    action: 'Build 3 gift set SKUs: The Wellness Gift (lamp + bath salts), The Cook\'s Gift (slab + recipe card), The Spa Gift (bath salts + candle holder). Go live 8 weeks before Christmas.',
  },
  {
    id: 'interiordesign',
    title: 'Interior Designer Trade Programme',
    icon: '🏠',
    aov: '£150–£600',
    effort: 'Low',
    effortColor: '#27ae60',
    timeframe: '2–4 weeks',
    badge: 'Easy Channel',
    badgeColor: '#27ae60',
    description: 'Interior designers and property stylists regularly source decorative objects in volume for client projects. Salt lamps are popular as statement pieces in wellness-led interiors. A trade programme offering 30–35% discount, net 30 payment terms, and a sample kit converts designers into repeat buyers. UK interior designer community: ~15,000 registered practitioners.',
    action: 'Register on Houzz Pro and Dezeen as a trade supplier. Create a Trade Application page. Send a sample kit to 20 designers in London and the South East.',
  },
  {
    id: 'cookingkits',
    title: 'Salt Cooking Experience Kits',
    icon: '🍳',
    aov: '£45–£90',
    effort: 'Low',
    effortColor: '#27ae60',
    timeframe: '2–4 weeks',
    badge: 'Differentiated',
    badgeColor: '#b86040',
    description: 'A Himalayan cooking slab + printed recipe card + curated spice set sold as an experience kit for home cooks and as a premium restaurant supplies product. Cooking with salt blocks is a growing trend driven by food content on YouTube and Instagram. Restaurants using salt slabs for table-side service buy in batches of 6–12. The kit format commands 2–3× the price of the slab alone.',
    action: 'Commission 3 recipe cards from a food stylist. Launch a "Cook on Salt" kit as a standalone product page and pitch to 10 independent restaurants.',
  },
  {
    id: 'corporate',
    title: 'Corporate Wellness Gifting',
    icon: '💼',
    aov: '£25–£60 per unit, min 50 units',
    effort: 'Medium',
    effortColor: '#e67e22',
    timeframe: '6–10 weeks',
    badge: 'B2B Volume',
    badgeColor: '#2980b9',
    description: 'HR departments purchasing employee wellbeing gifts represent a significant B2B channel. The UK corporate gifting market was valued at £1.5bn in 2023. Salt lamps (safe, inoffensive, wellness-aligned) are well-suited to this channel. A single corporate order of 100 units at £30 = £3,000 revenue. Provenance story ("directly from our Pakistani facility") differentiates from generic wellness gifts.',
    action: 'Create a Corporate Gifting page with a quantity enquiry form. Target HR managers via LinkedIn — search "employee wellbeing" + "gifting" in HR job titles.',
  },
  {
    id: 'affiliate',
    title: 'Wellness Influencer Programme',
    icon: '📸',
    aov: 'Drives £20–£60 per referred order',
    effort: 'Low',
    effortColor: '#27ae60',
    timeframe: '2–3 weeks',
    badge: 'No Ad Spend',
    badgeColor: '#8e44ad',
    description: 'UK wellness influencers on Instagram and Pinterest with 10k–100k followers typically work on 10–15% affiliate commission or product gifting + fee (£150–£500 per post). Salt lamps photograph extremely well — the warm glow is a natural fit for lifestyle, yoga, and interior content. An influencer with 40k engaged followers generating 2% click-through and 5% conversion = 40 orders per post. Zero ad budget.',
    action: 'Set up a Refersion or LTK affiliate programme. Gift 5 micro-influencers (20k–60k followers) in the wellness and home decor space. Track with UTM codes.',
  },
]

// ─── UK Regional Heat Map Data ─────────────────────────────────────────────
// Scale 1–10: B2C wellness demand | Spa density | Equestrian density
const REGIONS = [
  { name: 'London',            b2c: 10, spa: 10, equestrian: 4,  row: 0, col: 2 },
  { name: 'South East',        b2c: 9,  spa: 9,  equestrian: 9,  row: 1, col: 2 },
  { name: 'South West',        b2c: 8,  spa: 8,  equestrian: 10, row: 2, col: 1 },
  { name: 'East of England',   b2c: 7,  spa: 6,  equestrian: 9,  row: 1, col: 3 },
  { name: 'West Midlands',     b2c: 6,  spa: 5,  equestrian: 7,  row: 1, col: 1 },
  { name: 'East Midlands',     b2c: 5,  spa: 4,  equestrian: 8,  row: 1, col: 2 },
  { name: 'Yorkshire',         b2c: 7,  spa: 6,  equestrian: 8,  row: 0, col: 2 },
  { name: 'North West',        b2c: 7,  spa: 7,  equestrian: 6,  row: 0, col: 1 },
  { name: 'North East',        b2c: 4,  spa: 4,  equestrian: 5,  row: 0, col: 3 },
  { name: 'Wales',             b2c: 5,  spa: 5,  equestrian: 9,  row: 1, col: 0 },
  { name: 'Scotland',          b2c: 6,  spa: 6,  equestrian: 7,  row: 0, col: 0 },
  { name: 'N. Ireland',        b2c: 4,  spa: 3,  equestrian: 6,  row: 0, col: 4 },
]

const DEMOGRAPHICS = [
  { segment: 'Core B2C buyer', profile: 'Women aged 28–45', income: 'Household income £35k–£75k', note: 'AB/C1 socioeconomic groups; over-index on wellness, home interiors, and alternative health' },
  { segment: 'Gift buyer', profile: 'Mixed gender, 25–55', income: '£30k+ household', note: 'Buys for birthdays, Christmas, Mother\'s Day; searches Google and Pinterest; AOV 20–30% higher than self-purchase' },
  { segment: 'B2B: Spa managers', profile: 'Female, 30–50', income: 'Business buyer', note: 'Concentrated in London, South East, South West. Primary discovery channel: trade shows and Instagram' },
  { segment: 'B2B: Equestrian owners', profile: 'Mixed gender, 35–65', income: '£50k+ household', note: 'South East, South West, East of England, Wales. Monthly repeat buyer for salt licks' },
  { segment: 'B2B: Premium butchers', profile: 'Male, 35–60', income: 'Business buyer', note: 'Nationwide but concentrated in London, commuter belt. Looking for provenance-led ingredients' },
]

function HeatCell({ value, label }) {
  const intensity = value / 10
  const r = Math.round(184 + (42 - 184) * intensity)
  const g = Math.round(96 + (26 - 96) * intensity)
  const b = Math.round(64 + (14 - 64) * intensity)
  const bg = `rgb(${r},${g},${b})`
  const textColor = intensity > 0.5 ? '#fff' : '#2a1a0e'
  return (
    <div style={{
      background: bg,
      borderRadius: 6,
      padding: '10px 8px',
      textAlign: 'center',
      minWidth: 60,
    }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: textColor, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', color: textColor, opacity: 0.85, marginTop: 3, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

function RegionRow({ region }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr 1fr 1fr',
      gap: 8,
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #f0e8e0',
    }}>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', fontWeight: 500, color: '#2a1a0e' }}>{region.name}</div>
      <HeatCell value={region.b2c} label="B2C Demand" />
      <HeatCell value={region.spa} label="Spa Density" />
      <HeatCell value={region.equestrian} label="Equestrian" />
    </div>
  )
}

const SORT_KEYS = ['b2c', 'spa', 'equestrian']
const SORT_LABELS = { b2c: 'B2C Wellness Demand', spa: 'Spa & Wellness Density', equestrian: 'Equestrian Density' }

export default function RevenueView() {
  const [activeSort, setActiveSort] = useState('b2c')
  const [expandedStream, setExpandedStream] = useState(null)

  const sorted = [...REGIONS].sort((a, b) => b[activeSort] - a[activeSort])

  return (
    <div className="section-wrap">
      {/* ── Hero ── */}
      <div className="hero-title">
        <h2>Revenue Streams</h2>
        <p className="sub">
          Ten income channels beyond the core product sale. Ranked by time-to-first-revenue.
          The first three can be live within a month with no new inventory.
        </p>
      </div>

      {/* ── Quick wins callout ── */}
      <div className="cta-box green" style={{ marginBottom: 28 }}>
        <p>
          <strong>Three zero-inventory moves to do this month.</strong> Gift sets (bundle
          existing stock, new packaging), an interior designer trade page, and a wellness
          influencer outreach — all can generate revenue before any new product is sourced.
          Combined they could add £500–£2,000/month within 6 weeks.
        </p>
      </div>

      {/* ── Stream Cards ── */}
      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Revenue Channels — Click to Expand
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
        {STREAMS.map(stream => {
          const isOpen = expandedStream === stream.id
          return (
            <div
              key={stream.id}
              style={{
                border: `1px solid ${isOpen ? '#b86040' : '#e0d0c6'}`,
                borderRadius: 8,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              <button
                onClick={() => setExpandedStream(isOpen ? null : stream.id)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto auto auto',
                  gap: '0 16px',
                  alignItems: 'center',
                  padding: '14px 18px',
                  background: isOpen ? '#fdf8f5' : '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{stream.icon}</span>
                <div>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.05rem', fontWeight: 600, color: '#2a1a0e', letterSpacing: '0.04em' }}>
                    {stream.title}
                  </div>
                </div>
                <span className="badge-custom" style={{ background: stream.badgeColor, color: '#fff', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {stream.badge}
                </span>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.95rem', fontWeight: 600, color: '#b86040' }}>{stream.aov}</div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#999' }}>avg order</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 70 }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', color: stream.effortColor, fontWeight: 600 }}>{stream.effort}</div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#999' }}>effort</div>
                </div>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.3rem', color: '#b86040', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', marginLeft: 4 }}>+</span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 18px 18px', background: '#fdf8f5' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Avg Order Value', val: stream.aov },
                      { label: 'Effort', val: stream.effort },
                      { label: 'Time to Revenue', val: stream.timeframe },
                    ].map(chip => (
                      <div key={chip.label} style={{
                        background: '#fff',
                        border: '1px solid #e0d0c6',
                        borderRadius: 20,
                        padding: '4px 14px',
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '0.9rem',
                        color: '#555',
                      }}>
                        <span style={{ color: '#999' }}>{chip.label}: </span>
                        <span style={{ fontWeight: 600, color: '#2a1a0e' }}>{chip.val}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#555', lineHeight: 1.7, margin: '0 0 12px' }}>
                    {stream.description}
                  </p>
                  <div style={{ background: '#fff', border: '1px solid #d4b896', borderRadius: 6, padding: '12px 16px' }}>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.9rem', color: '#b86040', letterSpacing: '0.05em' }}>NEXT ACTION: </span>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', color: '#2a1a0e' }}>{stream.action}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bor" />

      {/* ── Demographics & Heat Map ── */}
      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', margin: '28px 0 8px' }}>
        UK Market Demographics
      </h4>
      <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#666', marginBottom: 20 }}>
        Who buys and where the money concentrates — B2C and B2B buyer profiles across UK regions.
      </p>

      {/* Demographics table */}
      <div style={{ overflowX: 'auto', marginBottom: 32 }}>
        <table className="sl-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Profile</th>
              <th>Income Band</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {DEMOGRAPHICS.map(d => (
              <tr key={d.segment}>
                <td style={{ fontWeight: 600, color: '#2a1a0e', whiteSpace: 'nowrap' }}>{d.segment}</td>
                <td>{d.profile}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{d.income}</td>
                <td style={{ fontSize: '0.95rem', color: '#666' }}>{d.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Regional heat map */}
      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 12 }}>
        Regional Demand Heat Map
      </h4>

      <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#666', marginBottom: 16, fontSize: '0.95rem' }}>
        Score out of 10. Darker = higher concentration. Sort by the channel most relevant to your next growth move.
      </p>

      {/* Sort buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SORT_KEYS.map(key => (
          <button
            key={key}
            onClick={() => setActiveSort(key)}
            style={{
              padding: '8px 18px',
              borderRadius: 4,
              border: `2px solid ${activeSort === key ? '#b86040' : '#e0d0c6'}`,
              background: activeSort === key ? '#b86040' : '#fff',
              color: activeSort === key ? '#fff' : '#555',
              fontFamily: 'Oswald, sans-serif',
              fontSize: '0.95rem',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Heat map header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr 1fr 1fr',
        gap: 8,
        padding: '8px 0',
        borderBottom: '2px solid #e0d0c6',
        marginBottom: 4,
      }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.85rem', color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Region</div>
        {['B2C Wellness Demand', 'Spa & Wellness Density', 'Equestrian Density'].map(h => (
          <div key={h} style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.85rem', color: '#888', letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'center' }}>{h}</div>
        ))}
      </div>

      {sorted.map(region => <RegionRow key={region.name} region={region} />)}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#888' }}>Intensity scale:</span>
        {[1, 3, 5, 7, 10].map(v => {
          const i = v / 10
          const r = Math.round(184 + (42 - 184) * i)
          const g = Math.round(96 + (26 - 96) * i)
          const b = Math.round(64 + (14 - 64) * i)
          return (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: 3, background: `rgb(${r},${g},${b})` }} />
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#888' }}>{v}/10</span>
            </div>
          )
        })}
      </div>

      <div className="bor" style={{ marginTop: 24 }} />

      {/* Summary band */}
      <div className="summary-band">
        <h3>Revenue Potential at a Glance</h3>
        <p>Ten channels. First three can go live this month with existing stock.</p>
        <div className="summary-stats">
          {[
            { num: '10', label: 'Revenue channels' },
            { num: '3', label: 'Zero-inventory quick wins' },
            { num: '£85', label: 'Max gift set AOV' },
            { num: '£5k', label: 'Single salt room project' },
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
