import React, { useState } from 'react'

/* ── Accordion shared component ───────────────────────────── */
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
            }}>{section.label}</div>
            <div style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '1.175rem',
              fontWeight: 600,
              color: isOpen ? '#fff' : '#2a1a0e',
              lineHeight: 1.3,
            }}>{section.title}</div>
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
          padding: '4px 10px', borderRadius: 20,
          background: isOpen ? 'rgba(255,255,255,0.18)' : 'rgba(184,96,64,0.1)',
          border: isOpen ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(184,96,64,0.3)',
          fontFamily: 'Oswald, sans-serif', fontSize: '0.85rem', letterSpacing: '0.05em',
          color: isOpen ? '#fff' : '#b86040', transition: 'all 0.2s',
        }}>
          {isOpen ? 'Close' : 'Expand'}
          <span style={{ display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', lineHeight: 1 }}>▾</span>
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

/* ── Data ─────────────────────────────────────────────────── */
const TARIFF_CODES = [
  { product: 'Electrical salt lamps', code: '9405 21 9090', duty: '2% (std) → 0% DCTS', note: 'Non-LED. If LED, use LED sub-code under 9405 21' },
  { product: 'Food-grade cooking slabs / butcher blocks', code: '2501 00 9100', duty: '0%', note: 'Confirm food-grade certificate from Pakistani supplier' },
  { product: 'Animal salt licks (horses / livestock)', code: '2501 00 9900', duty: '0%', note: 'Not for human consumption. May classify under Ch. 23 if mineral additives added' },
  { product: 'Salt wall panels (spas / décor)', code: '2501 00 9900', duty: '0%', note: 'Decorative / construction use — no food status needed' },
  { product: 'Salt tiles for dry-ageing (butchers)', code: '2501 00 9100', duty: '0%', note: 'Use food-grade code only if certified food-contact material' },
]

const VAT_RATES = [
  { product: 'Decorative electrical salt lamps', rate: '20% standard', reason: 'Electrical decorative goods — no food or animal feed exemption applies' },
  { product: 'Salt cooking slabs / butcher dry-age blocks', rate: '0% zero-rated', reason: 'Food-grade salt for human food use or food-contact material — VATA 1994 Sch 8 Group 1' },
  { product: 'Salt licks (horses / livestock)', rate: '0% zero-rated', reason: 'Animal feed for non-pet livestock — VATA 1994 Sch 8 Group 1. Pet animal licks = 20%' },
  { product: 'Salt wall panels (spa / halotherapy)', rate: '20% standard', reason: 'Interior fit-out / decorative — not food, not animal feed' },
  { product: 'Salt tiles (decorative / spa)', rate: '20% standard', reason: 'As above — standard-rated' },
]

const HEALTH_CLAIMS = [
  { claim: '"Purifies the air"', status: 'banned', reason: 'No human trial evidence. CAP Code Rule 12.1' },
  { claim: '"Releases negative ions"', status: 'banned', reason: 'No measurable ion output in typical room conditions' },
  { claim: '"Helps with asthma or allergies"', status: 'banned', reason: 'Medical/health claim — requires clinical trial evidence to substantiate' },
  { claim: '"Detoxifies your space"', status: 'banned', reason: 'Unsubstantiated health/environment claim — DMCC Act 2024' },
  { claim: '"Reduces bacteria or pollutants"', status: 'banned', reason: 'Environmental health claim — requires evidence per CAP Code Rule 3.1' },
  { claim: '"Creates a warm, relaxing ambience"', status: 'allowed', reason: 'Sensory/aesthetic description — no scientific evidence bar applies' },
  { claim: '"Natural Himalayan rock salt, hand-carved"', status: 'allowed', reason: 'Factual provenance claim — verifiable and not health-linked' },
  { claim: '"Popular for wellness-inspired interiors"', status: 'allowed', reason: 'Descriptive of use, not a therapeutic effect' },
  { claim: '"Used in spa and relaxation settings"', status: 'allowed', reason: 'Factual description of customer context — not a health claim' },
]

const RISK_CARDS = [
  {
    level: 'High', color: '#d63031', bgColor: '#fff5f5',
    title: 'Misleading health claims — lamps',
    detail: 'The DMCC Act 2024 allows the CMA to fine up to £300,000 or 10% of global annual turnover for misleading claims. "Air purification", "ionisation", or "asthma relief" language triggers this exposure without a prior warning.',
  },
  {
    level: 'High', color: '#d63031', bgColor: '#fff5f5',
    title: 'Lamp safety — no CE/UKCA test file',
    detail: 'A UK importer of mains-connected goods is the "responsible person" under SI 2016/1101. Without a test file, Declaration of Conformity, and English-language compliance documentation, you are personally liable if the product causes fire or shock.',
  },
  {
    level: 'Medium', color: '#e67e22', bgColor: '#fffaf5',
    title: 'Animal feed — unregistered FBO',
    detail: 'Selling salt licks without registering as a Feed Business Operator (FBO) with your local authority Trading Standards is an offence under the Animal Feed (England) Regulations 2010. Registration is free but mandatory.',
  },
  {
    level: 'Medium', color: '#e67e22', bgColor: '#fffaf5',
    title: 'Email marketing without valid consent',
    detail: 'Under PECR and UK GDPR, sending marketing emails to contacts who did not explicitly opt in can result in ICO fines. A 2024 ICO action fined a UK retailer £150,000 for incorrectly claiming the soft opt-in exemption. Every send must include an unsubscribe link.',
  },
]

/* ── Accordion section content ────────────────────────────── */
const SECTIONS = [
  {
    id: 'import',
    label: 'Import & Customs',
    title: 'Importing from Pakistan — tariff codes, duty rates & HMRC registration',
    icon: '🚢',
    content: (
      <div>
        <div className="cta-box green" style={{ marginBottom: 20 }}>
          <p>
            <strong>Good news: salt products import duty-free from Pakistan.</strong> All 2501 headings
            (salt) carry 0% duty regardless of origin. Lamps (9405) drop from 2% to 0% under the
            UK Developing Countries Trading Scheme (DCTS) — Pakistan qualifies at the Enhanced
            Preferences tier.
          </p>
        </div>

        <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 14 }}>UK Commodity Codes & Duty Rates</h4>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table className="sl-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>HS Code (10-digit)</th>
                <th>Duty Rate</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {TARIFF_CODES.map(row => (
                <tr key={row.code}>
                  <td style={{ fontWeight: 500 }}>{row.product}</td>
                  <td style={{ fontFamily: 'monospace', color: '#b86040', fontWeight: 600 }}>{row.code}</td>
                  <td>
                    <span className={`badge-custom ${row.duty === '0%' || row.duty.includes('→ 0%') ? 'badge-green' : 'badge-amber'}`}>
                      {row.duty}
                    </span>
                  </td>
                  <td className="table-sub">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="service-card">
            <div className="card-label">DCTS — Claiming 0% on Lamps</div>
            <h4>Pakistan Enhanced Preferences</h4>
            <p>To claim 0% duty on lamps instead of the 2% standard rate, you need:</p>
            <ul>
              <li>A <strong>Form A</strong> (GSP certificate of origin) from the Pakistani exporter, stamped by Pakistani authorities — or a REX (Registered Exporter) statement</li>
              <li>The preference code declared on your customs declaration in CDS</li>
              <li>Origin documentation retained for <strong>4 years minimum</strong></li>
            </ul>
          </div>
          <div className="service-card">
            <div className="card-label">HMRC Customs Declaration Service (CDS)</div>
            <h4>Before your first shipment</h4>
            <ul>
              <li>Apply for a <strong>GB EORI number</strong> at gov.uk — required before any import</li>
              <li>Subscribe to CDS using your EORI, UTR, and Government Gateway business account</li>
              <li>Either submit declarations yourself or appoint a licensed freight forwarder</li>
              <li>CHIEF (old system) is closed since June 2024 — CDS is mandatory</li>
              <li>CDS access typically confirms within 2–5 working days</li>
            </ul>
          </div>
        </div>

        <div className="cta-box" style={{ marginBottom: 0 }}>
          <p>
            <strong>For high-volume lamp imports, request a Binding Tariff Information (BTI) ruling from HMRC.</strong> This
            gives legal certainty on the commodity code classification and protects you if HMRC audits
            your import declarations. Apply via trade-tariff.service.gov.uk.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'safety',
    label: 'Product Safety & Certifications',
    title: 'UKCA/CE marking for lamps, food contact rules & what you can legally say',
    icon: '🛡️',
    content: (
      <div>
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="service-card">
            <div className="card-label">Electrical Lamps — UKCA / CE Marking</div>
            <h4>What you must have on file</h4>
            <p>
              Under the Electrical Equipment (Safety) Regulations 2016 (SI 2016/1101), the UK importer
              is the <strong>"responsible person"</strong> and must ensure:
            </p>
            <ul>
              <li>Test reports against <strong>BS EN 60598-1</strong> (luminaire general safety standard)</li>
              <li>A <strong>Declaration of Conformity (DoC)</strong> in English naming the product, regulation, and standard</li>
              <li>The UKCA or CE mark affixed (CE is accepted in GB indefinitely from Oct 2024)</li>
              <li>All technical documentation retained for <strong>10 years</strong></li>
            </ul>
            <p style={{ marginTop: 10, padding: '10px 14px', background: '#fdf0e8', borderRadius: 4, borderLeft: '3px solid #b86040', fontSize: '0.95rem' }}>
              <strong>Practical action:</strong> Commission a UKAS-accredited UK test laboratory to test
              one sample per lamp model. Cost: £500–£2,000 per SKU. This is your legal shield.
            </p>
          </div>
          <div className="service-card">
            <div className="card-label">Cooking Slabs & Butcher Blocks</div>
            <h4>Food Contact Material (FCM) requirements</h4>
            <p>
              Salt slabs in direct food contact are regulated under the retained UK version of
              Regulation (EC) No 1935/2004. Requirements:
            </p>
            <ul>
              <li>Material must not transfer constituents that endanger health or alter food taste/composition</li>
              <li>For B2B sales (food businesses), supply a <strong>Declaration of Compliance</strong> confirming the material is fit for food contact</li>
              <li>If sold direct to consumers as food-grade cooking products, <strong>FSA Food Information Regulations (FIR 2014)</strong> labelling applies</li>
              <li>Pre-notify via <strong>IPAFFS</strong> if required at the border (confirm with your port health authority)</li>
            </ul>
          </div>
        </div>

        <div className="service-card" style={{ marginBottom: 20 }}>
          <div className="card-label">Animal Salt Licks — DEFRA / FSA Registration</div>
          <h4>Feed Business Operator (FBO) registration is mandatory</h4>
          <div className="two-col" style={{ marginTop: 12 }}>
            <div>
              <p><strong>You must register as an FBO</strong> with your local authority Trading Standards (or APHA if manufacturing) before selling salt licks. Registration is free. Non-compliance is a criminal offence.</p>
              <p style={{ marginTop: 8 }}>Labels must carry:</p>
              <ul>
                <li>Species designation (e.g. "For horses and ponies")</li>
                <li>Business name and address</li>
                <li>Net weight + batch/lot number</li>
                <li>Declared <strong>sodium (Na) content %</strong></li>
                <li>Feeding instructions and best-before date</li>
                <li>Country of origin (Pakistan)</li>
              </ul>
            </div>
            <div>
              <p>Pure Himalayan rock salt classifies as a <strong>"mineral feed / complementary feed"</strong> under Regulation (EC) No 767/2009 (retained UK law).</p>
              <p style={{ marginTop: 8 }}>If the Pakistani supplier adds <em>any</em> trace mineral additives, those must appear on the UK authorised feed additives list. Pre-notification via <strong>IPAFFS</strong> is required for animal feed imports from third countries.</p>
              <p style={{ marginTop: 8 }}>Plain salt (non-animal-origin mineral) does not require country-level third-party approval — but confirm with APHA for your specific product.</p>
            </div>
          </div>
        </div>

        <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 14 }}>ASA CAP Code — Lamp Health Claims: Allowed vs Banned</h4>
        <div style={{ overflowX: 'auto' }}>
          <table className="sl-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {HEALTH_CLAIMS.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontStyle: 'italic' }}>"{row.claim.replace(/^"|"$/g, '')}"</td>
                  <td>
                    <span className={`badge-custom ${row.status === 'banned' ? 'badge-red' : 'badge-green'}`}>
                      {row.status === 'banned' ? '🚫 Banned' : '✓ Allowed'}
                    </span>
                  </td>
                  <td className="table-sub">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'vat',
    label: 'VAT & Tax',
    title: 'VAT rates by product, import VAT, Making Tax Digital',
    icon: '💷',
    content: (
      <div>
        <div className="three-col" style={{ marginBottom: 24 }}>
          {[
            { num: '£90,000', label: 'VAT registration threshold', sub: '2024/25 & 2025/26 — frozen until March 2026', color: '#27ae60' },
            { num: '20% / 0%', label: 'VAT rates on your products', sub: 'Lamps: 20%. Salt for food / animal feed: 0%', color: '#b86040' },
            { num: 'PVA', label: 'Import VAT method', sub: 'Postponed VAT Accounting — net cash impact is zero when VAT-registered', color: '#2980b9' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '16px 12px', background: '#fdf8f5', border: '1px solid #e8d8cc', borderRadius: 6 }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.num}</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.875rem', color: '#555', margin: '4px 0 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '0.875rem', color: '#888', lineHeight: 1.4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 14 }}>VAT Rate by Product</h4>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table className="sl-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>VAT Rate</th>
                <th>Legal Basis</th>
              </tr>
            </thead>
            <tbody>
              {VAT_RATES.map(row => (
                <tr key={row.product}>
                  <td style={{ fontWeight: 500 }}>{row.product}</td>
                  <td>
                    <span className={`badge-custom ${row.rate.includes('0%') ? 'badge-green' : 'badge-red'}`}>
                      {row.rate}
                    </span>
                  </td>
                  <td className="table-sub">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="service-card">
            <div className="card-label">Import VAT — Postponed VAT Accounting (PVA)</div>
            <h4>How to avoid cash flow impact at the border</h4>
            <ul>
              <li>Declare PVA by entering code <strong>'G'</strong> in box 47e of your CDS declaration</li>
              <li>Import VAT appears on your <strong>Monthly Postponed Import VAT Statement (MPIVS)</strong> — download from CDS; only available for 6 months</li>
              <li>Record as output tax in <strong>Box 1</strong> of VAT return; reclaim in <strong>Box 4</strong> — net cash impact is zero</li>
              <li>If below the VAT threshold, import VAT must be paid upfront at the border</li>
            </ul>
          </div>
          <div className="service-card">
            <div className="card-label">Making Tax Digital (MTD)</div>
            <h4>Digital record-keeping — mandatory for all VAT registrants</h4>
            <ul>
              <li>All VAT-registered businesses must use MTD-compatible software to submit returns directly</li>
              <li>Applies since <strong>April 2022</strong> — no turnover threshold exemption</li>
              <li>Non-compliance carries a points-based penalty system leading to financial penalties</li>
              <li>From <strong>April 2026</strong>, MTD for Income Tax applies to sole traders with qualifying income over £50,000</li>
              <li>Compatible software: Xero, QuickBooks, FreeAgent (all have free or low-cost tiers for small businesses)</li>
            </ul>
          </div>
        </div>

        <div className="cta-box green">
          <p>
            <strong>Zero-rating for animal feed and food-grade salt is a meaningful advantage.</strong> A
            £10,000 order of salt licks to a horse yard charges no VAT on the supply — which benefits
            non-VAT-registered B2B buyers (small equestrian farms). This is a genuine pricing edge
            over general retailers who may not correctly apply the zero-rating.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'fines',
    label: 'Fines & Key Risks',
    title: 'Penalties to avoid — health claims, safety testing, animal feed & GDPR',
    icon: '⚠️',
    content: (
      <div>
        <div className="cta-box" style={{ marginBottom: 24 }}>
          <p>
            <strong>Four risk areas carry real financial exposure.</strong> None of them require a
            prior breach — regulators can act proactively on live website content, import manifests,
            and marketing emails. Each risk below has a specific protection step.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
          {RISK_CARDS.map(card => (
            <div key={card.title} style={{
              background: card.bgColor,
              border: `1px solid ${card.color}40`,
              borderLeft: `4px solid ${card.color}`,
              borderRadius: 6,
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className={`badge-custom ${card.level === 'High' ? 'badge-red' : 'badge-amber'}`}>{card.level} Risk</span>
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, fontSize: '1.05rem', color: '#2a1a0e', marginBottom: 6 }}>
                {card.title}
              </div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', color: '#555', lineHeight: 1.6 }}>
                {card.detail}
              </div>
            </div>
          ))}
        </div>

        <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 14 }}>Protection Steps — One Action Per Risk</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { step: '1', action: 'Audit all lamp product pages', detail: 'Remove any air-purification, ionisation, or health-benefit claims. Replace with sensory/aesthetic language. Apply to website, packaging, and all social media bios.' },
            { step: '2', action: 'Commission lamp safety testing', detail: 'Send one sample of each lamp SKU to a UKAS-accredited lab for BS EN 60598-1 testing. Prepare an English-language Declaration of Conformity per SKU. Cost: £500–£2,000 per model. One-time investment.' },
            { step: '3', action: 'Register as a Feed Business Operator', detail: 'Contact your local authority Trading Standards (free registration) before selling the first salt lick. Design labels to include all mandatory fields: species, Na%, batch number, origin.' },
            { step: '4', action: 'Audit the email opt-in flow', detail: 'Ensure the signup form uses an unchecked checkbox, shows the exact consent text, and logs the timestamp. Store consent records indefinitely. Confirm every outgoing sequence has a working unsubscribe link.' },
          ].map(item => (
            <div key={item.step} style={{
              display: 'flex',
              gap: 16,
              background: '#fff',
              border: '1px solid #e0d0c6',
              borderRadius: 6,
              padding: '14px 18px',
              alignItems: 'flex-start',
            }}>
              <div style={{
                flexShrink: 0,
                width: 32, height: 32,
                background: '#b86040',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#fff', fontSize: '1.05rem',
              }}>{item.step}</div>
              <div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 500, fontSize: '1.05rem', color: '#2a1a0e', marginBottom: 4 }}>
                  {item.action}
                </div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', color: '#666', lineHeight: 1.6 }}>
                  {item.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: '14px 18px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6 }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.875rem', color: '#888', marginBottom: 6, letterSpacing: '0.06em' }}>
            KEY SOURCES — verify at these official URLs
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'UK Trade Tariff Tool', url: 'https://trade-tariff.service.gov.uk' },
              { label: 'UKCA Marking — GOV.UK', url: 'https://www.gov.uk/guidance/using-the-ukca-marking' },
              { label: 'ASA CAP Code §12', url: 'https://www.asa.org.uk/type/non_broadcast/code_section/12.html' },
              { label: 'ICO — Email Marketing (PECR)', url: 'https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications' },
              { label: 'FSA Animal Feed Legislation', url: 'https://www.food.gov.uk/business-guidance/animal-feed-legislation' },
              { label: 'CDS Registration — GOV.UK', url: 'https://www.gov.uk/guidance/get-access-to-the-customs-declaration-service' },
            ].map(src => (
              <a key={src.label} href={src.url} target="_blank" rel="noopener noreferrer"
                style={{ padding: '4px 10px', background: '#fff', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8rem', color: '#b86040', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif' }}
                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                onMouseLeave={e => e.target.style.textDecoration = 'none'}
              >{src.label} ↗</a>
            ))}
          </div>
        </div>
      </div>
    ),
  },
]

/* ── Main component ───────────────────────────────────────── */
export default function LegalitiesView() {
  const [openSection, setOpenSection] = useState('import')
  const toggle = (id) => setOpenSection(prev => prev === id ? null : id)

  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Legalities &amp; Compliance</h2>
        <p className="sub">
          UK law, import duties, VAT treatment, product safety, and the four penalty areas
          most likely to affect a Himalayan salt business. Based on HMRC, FSA, ASA, and ICO
          primary sources as of 2025.
        </p>
      </div>

      <div className="cta-box" style={{ marginBottom: 28 }}>
        <p>
          <strong>This section is for business planning — not legal advice.</strong> Verify
          current rates and regulations directly with HMRC, Trading Standards, and your
          accountant before making compliance decisions. All figures reflect 2024/2025
          rules unless noted.
        </p>
      </div>

      {SECTIONS.map((section) => (
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
