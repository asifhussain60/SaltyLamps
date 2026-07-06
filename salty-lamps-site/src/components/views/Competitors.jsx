import React, { useState } from 'react'

/* ── Existing competitor data ─────────────────────────────── */
const COMPETITORS = [
  {
    brand: 'The Lamp Life',
    url: 'thelamplife.co',
    platform: { cls: 'badge-blue', label: 'Shopify' },
    strengths: 'Active blog, multi-currency',
    gap: 'No manufacturing story, no B2B',
    edge: 'Brand depth + B2B + manufacturer authority',
    highlight: false,
  },
  {
    brand: 'Himalayan Salt Direct',
    url: 'himalayansaltdirect.co.uk',
    platform: { cls: 'badge-amber', label: 'Custom' },
    strengths: 'Trusted since 2012, next-day delivery',
    gap: 'Dated design, poor Core Web Vitals',
    edge: 'Modern UX, storytelling, faster loads',
    highlight: false,
  },
  {
    brand: 'Mystic Moments',
    url: 'mysticmomentsuk.com',
    platform: { cls: 'badge-blue', label: 'Shopify' },
    strengths: 'Strong SEO, large catalogue',
    gap: 'Salt is one of hundreds — no specialist authority',
    edge: 'Own "Himalayan salt specialist" positioning',
    highlight: false,
  },
  {
    brand: 'Namaste Fair Trade',
    url: 'namaste-uk.com',
    platform: { cls: 'badge-amber', label: 'Custom' },
    strengths: 'Ethical sourcing, wholesale focus',
    gap: 'Old UI, slow loads',
    edge: 'Surpass on visual quality, speed',
    highlight: false,
  },
  {
    brand: 'Salty Lamps (target)',
    url: 'saltylamps.co.uk',
    platform: { cls: 'badge-green', label: 'React + Vite' },
    strengths: 'Direct manufacturer, 7 categories, unique B2B',
    gap: 'Currently exploiting none',
    edge: 'Category leader: brand + content + B2B + manufacturing',
    highlight: true,
  },
]

/* ── B2C channels ─────────────────────────────────────────── */
const B2C_CHANNELS = [
  {
    channel: 'Instagram',
    what: 'Ambient lifestyle photos, short Reels, mine-to-home provenance story. 3 posts/week.',
    time: '3–4 hrs/wk',
    badge: 'badge-blue',
  },
  {
    channel: 'Pinterest',
    what: 'Gift guides, mood boards, "salt lamp for X room" pins. 5 pins/week.',
    time: '1–2 hrs/wk',
    badge: 'badge-red',
  },
  {
    channel: 'Email',
    what: 'Welcome sequence + seasonal drops + gift guides. Set up once, runs itself.',
    time: '1 hr/wk',
    badge: 'badge-green',
  },
  {
    channel: 'Google Business Profile',
    what: 'Verified UK listing — local trust signal, review collection, map presence.',
    time: '30 min/wk',
    badge: 'badge-amber',
  },
]

/* ── Content calendar ─────────────────────────────────────── */
const CONTENT_CALENDAR = [
  { month: 'Month 1', title: 'Do Himalayan salt lamps actually work?', keyword: 'do salt lamps work uk', audience: 'B2C', badge: 'badge-blue' },
  { month: 'Month 1', title: 'From the Khewra mine to your home', keyword: 'himalayan salt lamp manufacturer uk', audience: 'B2C', badge: 'badge-blue' },
  { month: 'Month 2', title: 'Salt walls for spas: the complete buyer\'s guide', keyword: 'salt wall spa uk supplier', audience: 'B2B', badge: 'badge-green' },
  { month: 'Month 2', title: 'How to choose the right salt lamp for your bedroom', keyword: 'best himalayan salt lamp bedroom', audience: 'B2C', badge: 'badge-blue' },
  { month: 'Month 3', title: 'Himalayan salt dry-ageing: what every butcher needs to know', keyword: 'himalayan salt dry ageing butchers uk', audience: 'B2B', badge: 'badge-green' },
  { month: 'Month 3', title: 'Which salt lick is right for my horse?', keyword: 'himalayan salt lick horse uk', audience: 'B2B', badge: 'badge-green' },
  { month: 'Month 4', title: 'Salt lamp for sleep — the science explained', keyword: 'himalayan salt lamp sleep benefits', audience: 'B2C', badge: 'badge-blue' },
  { month: 'Month 4', title: 'Setting up a halotherapy room on a budget', keyword: 'halotherapy room setup uk', audience: 'B2B', badge: 'badge-green' },
  { month: 'Month 5', title: 'Why interior designers are specifying salt walls', keyword: 'salt wall interior design uk', audience: 'B2C/B2B', badge: 'badge-amber' },
  { month: 'Month 5', title: 'Horse salt lick vs loose salt: which is better?', keyword: 'horse salt lick vs loose salt', audience: 'B2B', badge: 'badge-green' },
  { month: 'Month 6', title: 'The gift guide: Himalayan salt lamps for everyone', keyword: 'himalayan salt lamp gift uk', audience: 'B2C', badge: 'badge-blue' },
  { month: 'Month 6', title: 'How to source Himalayan salt lamps direct from manufacturer', keyword: 'himalayan salt lamps wholesale direct uk', audience: 'B2B', badge: 'badge-green' },
]

/* ── Accordion sections ───────────────────────────────────── */
const ACCORDION = [
  {
    id: 'positioning',
    label: 'Strategic positioning',
    title: 'The untaken space — one brand, two audiences',
    icon: '🎯',
    content: (
      <div>
        <div className="cta-box green" style={{ marginBottom: 20 }}>
          <p>
            <strong>No UK competitor holds all three pillars simultaneously.</strong> Direct
            manufacturer + B2C retail shop + B2B portal for spas, butchers, and equestrian
            businesses. This gap is uncontested and immediately claimable.
          </p>
        </div>
        <div className="three-col">
          <div className="service-card">
            <div className="card-label">Pillar 1</div>
            <h4>Direct Manufacturer</h4>
            <p>
              Khewra mine → our facility → your door. No middleman. The supply chain story
              justifies better trade pricing and gives B2C buyers authentic provenance — something
              no retailer can replicate.
            </p>
          </div>
          <div className="service-card">
            <div className="card-label">Pillar 2</div>
            <h4>B2C Retail</h4>
            <p>
              Home buyers, gift-givers, wellness enthusiasts. Emotional, lifestyle-led marketing
              on Instagram and Pinterest. Email nurture from welcome to repeat purchase. No ad
              budget needed — organic only.
            </p>
          </div>
          <div className="service-card">
            <div className="card-label">Pillar 3</div>
            <h4>B2B Trade</h4>
            <p>
              Spas, halotherapy rooms, premium butchers, equestrian yards. Each vertical gets
              its own landing page, benefit copy, and search terms. None of the four competitors
              studied targets these sectors at all.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'b2c',
    label: 'B2C strategy',
    title: 'Consumer marketing — one person, built to scale',
    icon: '🏠',
    content: (
      <div>
        <p style={{ marginBottom: 20 }}>
          Four channels, each sized for one person. Total weekly commitment: <strong>6–8 hours</strong>.
          Every channel feeds the others — a blog post becomes Pinterest pins, goes into the email
          newsletter, and attracts a backlink. One piece of content, four channels.
        </p>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table className="sl-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>What to post</th>
                <th>Time per week</th>
              </tr>
            </thead>
            <tbody>
              {B2C_CHANNELS.map((row) => (
                <tr key={row.channel}>
                  <td>
                    <span className={`badge-custom ${row.badge}`}>{row.channel}</span>
                  </td>
                  <td>{row.what}</td>
                  <td style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, color: '#b86040', whiteSpace: 'nowrap' }}>
                    {row.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="two-col">
          <div className="service-card">
            <div className="card-label">Instagram content themes</div>
            <h4>What to post</h4>
            <ul>
              <li>Glowing lamp photography in real homes (ask customers to share)</li>
              <li>Behind-the-scenes: packing, products, the process</li>
              <li>Reels: "This is what a real Himalayan salt lamp looks like vs a fake"</li>
              <li>Seasonal: Christmas gifting, New Year wellness, Valentine's</li>
              <li>Provenance: photos of the Khewra mine and the crystal story</li>
            </ul>
          </div>
          <div className="service-card">
            <div className="card-label">Email welcome sequence</div>
            <h4>5-email consumer flow</h4>
            <ul>
              <li><strong>Day 0</strong> — Welcome + brand story (who we are, the mine)</li>
              <li><strong>Day 2</strong> — Product education (what to expect, lamp care)</li>
              <li><strong>Day 5</strong> — First offer (10% off, time-limited)</li>
              <li><strong>Day 14</strong> — Review request (link to Google + Trustpilot)</li>
              <li><strong>Day 21</strong> — "You might also love" upsell (gift sets, animals licks)</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'b2b-spa',
    label: 'B2B · Spas',
    title: 'Spas & halotherapy — the biggest B2B opportunity',
    icon: '🧖',
    content: (
      <div>
        <div className="cta-box" style={{ marginBottom: 20 }}>
          <p>
            <strong>Saltan is the only current supplier actively targeting this vertical</strong> — and
            they only sell salt walls, not lamps. There is no specialist lamp supplier speaking
            the language of spa owners. Salty Lamps can own this with one landing page and two
            blog articles.
          </p>
        </div>
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="service-card">
            <div className="card-label">Who we're targeting</div>
            <h4>The buyer</h4>
            <p>
              Spa owners, wellness centre directors, yoga studio managers, halotherapy room
              operators. They search for suppliers in bulk — they want reliability, competitive
              trade pricing, and to buy direct.
            </p>
            <p>
              Average order value for a spa fitting out a salt room: <strong>£800–£3,000+</strong>.
              One converted trade customer outweighs dozens of B2C sales.
            </p>
          </div>
          <div className="service-card">
            <div className="card-label">What they need to hear</div>
            <h4>The message</h4>
            <ul>
              <li>Direct from manufacturer — no middleman markup</li>
              <li>Bulk pricing available, consistent stock</li>
              <li>"Your clients will ask about the salt wall — here's what to tell them"</li>
              <li>UK delivery, reliable lead times</li>
              <li>Trade account with net-30 terms (future offer)</li>
            </ul>
          </div>
        </div>
        <div className="service-card">
          <div className="card-label">Keywords to own — all uncontested</div>
          <h4>Search terms with zero specialist competition</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {['salt wall spa UK', 'himalayan salt room supplier UK', 'salt lamps wholesale spa', 'halotherapy equipment supplier UK', 'salt wall supplier UK'].map(kw => (
              <span key={kw} className="badge-custom badge-blue">{kw}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'b2b-butchers',
    label: 'B2B · Butchers',
    title: 'Butchers & restaurants — dry-ageing is a premium market',
    icon: '🥩',
    content: (
      <div>
        <div className="cta-box" style={{ marginBottom: 20 }}>
          <p>
            <strong>Premium butchers and restaurants pay a premium for dry-aged beef.</strong> Himalayan
            salt blocks and tiles are used for ageing chambers and as theatrical serving surfaces.
            No lamp retailer currently targets this vertical — the only player is Saltan's SaltAge
            product, and they don't carry lamps or decorative pieces.
          </p>
        </div>
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="service-card">
            <div className="card-label">Who we're targeting</div>
            <h4>The buyer</h4>
            <p>
              Independent butchers, farm shops with meat counters, steakhouse restaurants, and
              the growing direct-to-consumer aged-beef box market. They search for "himalayan
              salt dry ageing" and find almost nothing from a specialist UK supplier.
            </p>
          </div>
          <div className="service-card">
            <div className="card-label">Products that serve this vertical</div>
            <h4>What they buy</h4>
            <ul>
              <li>Large Himalayan salt blocks for ageing chamber walls</li>
              <li>Salt cooking slabs for hot presentation service</li>
              <li>Decorative salt display pieces for the shop counter</li>
              <li>Salt tiles in bulk for lining ageing fridges</li>
            </ul>
          </div>
        </div>
        <div className="service-card">
          <div className="card-label">Keywords to own — zero competition from lamp retailers</div>
          <h4>Uncontested search terms</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {['himalayan salt dry ageing butchers UK', 'salt block meat ageing UK', 'himalayan salt tiles wholesale UK', 'salt cooking slab supplier UK', 'dry age fridge salt wall UK'].map(kw => (
              <span key={kw} className="badge-custom badge-amber">{kw}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'b2b-equestrian',
    label: 'B2B · Equestrian',
    title: 'Equestrian yards & farm shops — the overlooked repeat buyer',
    icon: '🐴',
    content: (
      <div>
        <div className="cta-box" style={{ marginBottom: 20 }}>
          <p>
            <strong>Salt licks are a consumable — horses go through them regularly.</strong> A yard
            with 10 horses is a repeat order every 4–6 weeks. The four lamp retailers either
            carry lick SKUs with no marketing (The Lamp Life) or ignore the segment entirely.
            No one speaks directly to equestrian buyers as a manufacturer.
          </p>
        </div>
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="service-card">
            <div className="card-label">Who we're targeting</div>
            <h4>The buyer</h4>
            <p>
              Livery yard owners, private horse owners, rural farm shop buyers, equestrian
              retailers, and pet shop owners. They search by weight and type — "2kg himalayan
              salt lick" or "himalayan salt lick on rope horse." These are high-volume, repeat
              purchases.
            </p>
          </div>
          <div className="service-card">
            <div className="card-label">The repeat purchase angle</div>
            <h4>Why this is the best B2B margin</h4>
            <ul>
              <li>Horses consume 1–2 licks per month in active seasons</li>
              <li>Yards buy in bulk — 12–24 units at a time</li>
              <li>Farm shops reorder monthly to keep shelves stocked</li>
              <li>Low acquisition cost — one blog post ranks for the vertical forever</li>
              <li>Seasonal peak: spring and summer when horses are active</li>
            </ul>
          </div>
        </div>
        <div className="service-card">
          <div className="card-label">Keywords to own — equestrian retailers don't come from this angle</div>
          <h4>Uncontested search terms from a manufacturer</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {['himalayan salt lick horse UK', 'salt lick wholesale supplier UK', 'himalayan salt licks bulk buy', 'horse mineral salt lick UK', 'salt licks for equestrian yards'].map(kw => (
              <span key={kw} className="badge-custom badge-green">{kw}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'content',
    label: 'Content calendar',
    title: '12 articles in 6 months — the organic foundation',
    icon: '✍️',
    content: (
      <div>
        <div className="cta-box green" style={{ marginBottom: 20 }}>
          <p>
            <strong>Two articles per month — one B2C, one B2B.</strong> Each targets a real search
            term with near-zero competition. A published article takes 60–90 days to rank;
            by month 6 the first wave is generating free trade enquiries and consumer traffic
            simultaneously.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sl-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Article title</th>
                <th>Target keyword</th>
                <th>Audience</th>
              </tr>
            </thead>
            <tbody>
              {CONTENT_CALENDAR.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, color: '#b86040', whiteSpace: 'nowrap' }}>
                    {row.month}
                  </td>
                  <td style={{ fontWeight: 500 }}>{row.title}</td>
                  <td className="table-sub" style={{ fontStyle: 'italic' }}>"{row.keyword}"</td>
                  <td>
                    <span className={`badge-custom ${row.badge}`}>{row.audience}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'email',
    label: 'Email flows',
    title: 'Two email sequences — set up once, run forever',
    icon: '📧',
    content: (
      <div>
        <p style={{ marginBottom: 20 }}>
          Email delivers the highest ROI of any channel (42:1 on average). Both sequences below
          are written once, automated in Klaviyo or Mailchimp, and require no ongoing maintenance
          beyond seasonal drops.
        </p>
        <div className="two-col">
          <div className="service-card">
            <div className="card-label">Consumer welcome — 5 emails</div>
            <h4>B2C sequence</h4>
            <ul>
              <li><strong>Day 0 —</strong> Welcome + brand story. The mine, the family, why we exist.</li>
              <li><strong>Day 2 —</strong> Product education. How to care for your lamp, what to expect.</li>
              <li><strong>Day 5 —</strong> First offer. 10% off next order, 48-hour expiry.</li>
              <li><strong>Day 14 —</strong> Review request. Google + Trustpilot links, one-click.</li>
              <li><strong>Day 21 —</strong> Upsell. "You might also love" — gift sets, animal licks, cooking slabs.</li>
            </ul>
          </div>
          <div className="service-card">
            <div className="card-label">Trade enquiry — 3 emails</div>
            <h4>B2B onboarding sequence</h4>
            <ul>
              <li><strong>Day 0 —</strong> "Thanks for your trade enquiry." Attach PDF price list. Confirm their sector.</li>
              <li><strong>Day 3 —</strong> Sector-specific case study. Spa gets halotherapy article. Butcher gets dry-ageing piece. Equestrian gets lick guide.</li>
              <li><strong>Day 7 —</strong> "Ready to place your first order?" Direct link to trade checkout or phone CTA. Scarcity note if applicable.</li>
            </ul>
          </div>
        </div>
        <div className="service-card" style={{ marginTop: 4 }}>
          <div className="card-label">Seasonal calendar — layer on top of the sequences</div>
          <h4>Key send dates</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }}>
            {[
              { period: 'October', note: 'Halloween / gifting season tease' },
              { period: 'November', note: 'Black Friday + Christmas gift guide' },
              { period: 'December', note: 'Last-order dates + January wellness' },
              { period: 'February', note: 'Valentine\'s gifting campaign' },
              { period: 'April', note: 'Spring equestrian lick season' },
              { period: 'June', note: 'Summer spa / wellness peak' },
            ].map(item => (
              <div key={item.period} style={{ background: '#fdf8f5', border: '1px solid #e8d8cc', borderRadius: 4, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, color: '#b86040', fontSize: '1rem' }}>{item.period}</div>
                <div style={{ fontSize: '1rem', color: '#666', marginTop: 4 }}>{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'provenance',
    label: 'Provenance story',
    title: 'The story no competitor can tell — direct from the mine',
    icon: '⛏️',
    content: (
      <div>
        <div className="cta-box" style={{ marginBottom: 20 }}>
          <p>
            <strong>The Khewra mine in Pakistan is one of the oldest and largest salt mines in the world.</strong>{' '}
            No UK competitor publishes a genuine supply chain story. This narrative is Salty Lamps'
            most powerful differentiator — it builds E-E-A-T authority with Google, creates backlink
            bait, and gives Salty Lamps a constant stream of authentic social content.
          </p>
        </div>
        <div className="timeline">
          {[
            { label: 'The mine', detail: 'Khewra Salt Mine, Punjab, Pakistan. 300 million years of geological history. The source of every Salty Lamps product — photograph it, film it, tell its story.' },
            { label: 'Hand extraction', detail: 'Salt crystals are hand-excavated, not machine-cut. This is an E-E-A-T signal, an Instagram Reel, and a Pinterest board simultaneously.' },
            { label: 'Quality selection', detail: 'Only specific colour grades are selected for lamp production. Publish the selection criteria — it educates buyers and builds credibility over every retailer.' },
            { label: 'Direct import', detail: 'No distributor. Salty Lamps imports direct. This is the price story for trade buyers and the authenticity story for B2C buyers — same fact, two audiences.' },
            { label: 'Your door', detail: 'UK-based, fast despatch, reliable stock. The promise that two competitors (Himalayan Salt Direct, Mystic Moments) are currently failing to keep — 5 of 7 SKUs out of stock at time of research.' },
          ].map((step, i) => (
            <div key={i} className="phase">
              <h5>{step.label}</h5>
              <p>{step.detail}</p>
            </div>
          ))}
        </div>
        <div className="service-card" style={{ marginTop: 8 }}>
          <div className="card-label">Content assets this story unlocks</div>
          <h4>One story, many formats</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 10 }}>
            {[
              { format: 'About page', output: 'Long-form manufacturer story — the strongest E-E-A-T signal a salt lamp site can have' },
              { format: 'Instagram Reels', output: 'Mine footage, crystal photography, packing process — no competitor has this content' },
              { format: 'Blog anchor article', output: '"How our Himalayan salt lamps are made" — ranks for provenance terms, earns natural backlinks' },
              { format: 'Trade PDF', output: 'One-page "why buy direct" document sent as email attachment to every B2B enquiry' },
            ].map(item => (
              <div key={item.format} style={{ paddingLeft: 12, borderLeft: '3px solid #d4956b' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, color: '#b86040', fontSize: '1rem' }}>{item.format}</div>
                <div style={{ fontSize: '1rem', color: '#666', marginTop: 4 }}>{item.output}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
]

/* ── Accordion item component ─────────────────────────────── */
function AccordionItem({ section, isOpen, onToggle }) {
  const [hovered, setHovered] = React.useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (isOpen && ref.current) {
      setTimeout(() => ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }, [isOpen])

  const closedBg = hovered ? '#fdf0e8' : '#fff'

  return (
    <div ref={ref} style={{
      border: isOpen ? '1px solid #b86040' : '1px solid #e0d0c6',
      borderRadius: 6,
      marginBottom: 10,
      overflow: 'hidden',
      background: '#fff',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: isOpen ? '#b86040' : closedBg,
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.2s',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span style={{ fontSize: 20 }}>{section.icon}</span>
          <div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '1rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isOpen ? 'rgba(255,255,255,0.8)' : '#b86040',
              marginBottom: 2,
            }}>
              {section.label}
            </div>
            <div style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '1.175rem',
              fontWeight: 600,
              color: isOpen ? '#fff' : '#2a1a0e',
              lineHeight: 1.3,
            }}>
              {section.title}
            </div>
          </div>
        </div>
        {/* Expand / collapse pill */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          flexShrink: 0,
          padding: '4px 10px',
          borderRadius: 20,
          background: isOpen ? 'rgba(255,255,255,0.18)' : 'rgba(184,96,64,0.1)',
          border: isOpen ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(184,96,64,0.3)',
          fontFamily: 'Oswald, sans-serif',
          fontSize: '0.85rem',
          letterSpacing: '0.05em',
          color: isOpen ? '#fff' : '#b86040',
          transition: 'all 0.2s',
        }}>
          {isOpen ? 'Close' : 'Expand'}
          <span style={{
            display: 'inline-block',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            lineHeight: 1,
          }}>▾</span>
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: '20px 22px', borderTop: '1px solid #e8d8cc' }}>
          {section.content}
        </div>
      )}
    </div>
  )
}

/* ── Main component ───────────────────────────────────────── */
export default function Competitors() {
  const [openSection, setOpenSection] = useState('positioning')

  const toggle = (id) => setOpenSection(prev => prev === id ? null : id)

  return (
    <div className="section-wrap">

      {/* ── Existing competitor analysis ── */}
      <div className="hero-title">
        <h2>Competitors &amp; Our Edge</h2>
        <p className="sub">
          Four UK competitors researched with live site visits. None occupy the manufacturer +
          retail + B2B position simultaneously.
        </p>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table className="sl-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Platform</th>
              <th>Strengths</th>
              <th>Gap We Exploit</th>
              <th>Our Edge</th>
            </tr>
          </thead>
          <tbody>
            {COMPETITORS.map((row) => (
              <tr key={row.brand} className={row.highlight ? 'highlight' : ''}>
                <td>
                  <div style={{ fontWeight: row.highlight ? 600 : 400 }}>{row.brand}</div>
                  <div className="table-sub">
                    <a href={`https://${row.url}`} target="_blank" rel="noopener noreferrer" style={{ color: '#b86040', textDecoration: 'none' }}
                      onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.target.style.textDecoration = 'none'}
                    >{row.url}</a>
                  </div>
                </td>
                <td>
                  <span className={`badge-custom ${row.platform.cls}`}>{row.platform.label}</span>
                </td>
                <td>{row.strengths}</td>
                <td>{row.gap}</td>
                <td>{row.edge}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="three-col">
        <div className="service-card">
          <div className="card-label">Strategic positioning</div>
          <h4>Untaken space</h4>
          <p>
            No UK brand simultaneously claims all three pillars: direct manufacturer, B2C retail
            shop, and B2B portal for spas, butchers, and equestrian businesses. This gap is
            uncontested and immediately claimable.
          </p>
        </div>
        <div className="service-card">
          <div className="card-label">Keyword opportunity</div>
          <h4>SEO keyword gap</h4>
          <p>B2B terms carry very low competition:</p>
          <ul>
            <li>&ldquo;salt walls for spas UK&rdquo;</li>
            <li>&ldquo;salt brick meat curing UK&rdquo;</li>
            <li>&ldquo;horse lick supplier UK&rdquo;</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            All three can rank <strong>#1 within 60 days</strong> of the site going live.
          </p>
        </div>
        <div className="service-card">
          <div className="card-label">International opportunity</div>
          <h4>International gap</h4>
          <p>
            No competitor has clean EU or US localisation. Building with currency switching,
            hreflang tags, and VAT handling from day one gives Salty Lamps first-mover advantage
            in non-UK markets.
          </p>
        </div>
      </div>

      {/* ── Marketing strategy section ── */}
      <div className="bor" style={{ margin: '32px 0 28px' }} />

      <div className="hero-title" style={{ marginBottom: 24 }}>
        <h2>Marketing Strategy</h2>
        <p className="sub">
          Built to run solo from scratch — organic only, no ad spend, channels
          that compound. B2C and B2B treated as separate audiences with separate messages.
        </p>
      </div>

      {ACCORDION.map((section) => (
        <AccordionItem
          key={section.id}
          section={section}
          isOpen={openSection === section.id}
          onToggle={() => toggle(section.id)}
        />
      ))}

    </div>
  )
}
