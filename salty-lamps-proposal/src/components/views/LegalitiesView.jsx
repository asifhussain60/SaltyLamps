import React, { useState } from 'react'

const SECTIONS = [
  {
    id: 'import',
    title: 'Import & Customs',
    icon: '📦',
    summary: 'HS tariff codes, DCTS zero-rate, CDS declarations, rules of origin',
    content: [
      {
        type: 'callout',
        text: 'Pakistan qualifies for Enhanced Preferences under the UK DCTS (Developing Countries Trading Scheme, in force 19 June 2023), reducing import duty on salt lamps from 2% to 0%. Claim it on every shipment — HMRC defaults to the higher rate if you omit the documentation.',
      },
      {
        type: 'table',
        heading: 'Commodity (HS) Codes to Declare',
        cols: ['Product', 'Commodity Code', 'Standard Duty', 'DCTS Rate'],
        rows: [
          ['Electrical salt lamps', '9405 29 9090', '2.0%', '0% ✓'],
          ['Cooking salt slabs (food grade)', '2501 00 1000', '0%', '0%'],
          ['Livestock / horse salt licks', '2309 90 1000', '0–3%', '0% ✓'],
        ],
      },
      {
        type: 'list',
        heading: 'Claiming DCTS Preference — Checklist',
        items: [
          'Your Pakistani supplier must issue a Form A certificate (via TDAP — Trade Development Authority of Pakistan) OR a GSP origin declaration on the commercial invoice.',
          'On your CDS import declaration: use document code 9001 (origin declaration) or N865 (Form A), plus preference code in the 200-series in data element 4/17.',
          'Missing this documentation defaults HMRC to the standard MFN rate — there is no automatic refund.',
          'Apply for a Binding Tariff Information (BTI) decision from HMRC if you are unsure of the correct code. It is legally binding and protects you from reclassification penalties.',
        ],
      },
      {
        type: 'list',
        heading: 'Customs Declaration Service (CDS) Requirements',
        items: [
          'The old CHIEF system closed September 2022 — all imports now use CDS.',
          'You need: an EORI number linked to your Government Gateway account; a financial account (Duty Deferment Account or Cash Account).',
          'Use Postponed VAT Accounting (PVA) to avoid paying import VAT at the border — declare and recover on the same VAT return. Access your Monthly Postponed Import VAT Statement (MPIVS) from HMRC by the 8th working day of each month.',
          'Either submit declarations yourself via CDS-compatible software, or use a licensed customs broker.',
        ],
      },
    ],
  },
  {
    id: 'safety',
    title: 'Product Safety & Certifications',
    icon: '🛡️',
    summary: 'UKCA/CE marking, electrical compliance, health claims, food safety, animal feed',
    content: [
      {
        type: 'callout',
        text: 'CE marking remains legally accepted in Great Britain until 31 December 2027 under transitional provisions. After that date, UKCA is mandatory. As the importer placing products on the GB market, you are the "economic operator" legally responsible for conformity from day one.',
      },
      {
        type: 'table',
        heading: 'Which Products Require UKCA Marking?',
        cols: ['Product', 'UKCA Required?', 'Regulation', 'Standard'],
        rows: [
          ['Electrical salt lamps', '✅ Yes', 'Electrical Equipment (Safety) Regs 2016', 'BS EN 60598 (luminaires)'],
          ['Cooking salt slabs', '❌ No', 'Food Information Regulations 2014 apply', 'FSA food-grade rules'],
          ['Animal salt licks', '❌ No', 'Animal Feed (England) Regulations 2010 apply', 'APHA registration required'],
        ],
      },
      {
        type: 'list',
        heading: 'Electrical Lamp Compliance — What You Must Hold',
        items: [
          'Technical Documentation showing how the lamp meets essential safety requirements in Schedule 1 of the 2016 Regulations.',
          'A signed UK Declaration of Conformity (DoC) — this is your legal statement that you take responsibility for the product\'s safety. Must be available to Trading Standards on request.',
          'UKCA or CE mark on the product itself, the packaging, and the DoC.',
          'The specific risk: Pakistani suppliers may use non-compliant lamp holders, cords, and switches. The salt crystal is not the hazard — the electrical fitting is. Ask for IEC 60598 test certificates before your first shipment.',
        ],
      },
      {
        type: 'warning',
        heading: '⚠ What You CANNOT Say About Salt Lamps (ASA CAP Code)',
        text: 'The ASA has no credible peer-reviewed evidence that salt lamps emit ions in quantities affecting air quality. The following claims are banned under CAP Rules 3.7 (substantiation) and 12.1 (health/medicinal claims):',
        banned: [
          '"Purify or clean the air"',
          '"Release negative ions" (as a health benefit)',
          '"Reduce airborne bacteria, allergens, or pollutants"',
          '"Improve respiratory health, asthma, or allergies"',
          '"Treat or alleviate any medical condition"',
          '"Improve sleep, mood, or stress" (as a therapeutic claim)',
        ],
        allowed: 'You CAN say: "Creates a warm, ambient glow," "a decorative piece," "popular with yoga studios and spas," "made from authentic Himalayan rock salt from Pakistan."',
      },
    ],
  },
  {
    id: 'vat',
    title: 'VAT & Tax',
    icon: '💷',
    summary: 'Registration threshold, zero-rating for food & feed, Making Tax Digital, import VAT',
    content: [
      {
        type: 'callout',
        text: 'The VAT registration threshold is £90,000 taxable turnover in any rolling 12-month period (frozen until at least 31 March 2026). You must register within 30 days of crossing it. The deregistration threshold is £88,000.',
      },
      {
        type: 'table',
        heading: 'VAT Rates by Product',
        cols: ['Product', 'VAT Rate', 'Authority', 'Key Condition'],
        rows: [
          ['Electrical salt lamps', '20% (standard)', 'Non-food, non-essential item', 'Always standard rated'],
          ['Cooking salt slabs', '0% (zero-rated)', 'VATA 1994, Schedule 8, Group 1', 'Must be described and sold as food'],
          ['Livestock / horse salt licks', '0% (zero-rated)', 'VAT Notice 701/15, section 5', 'Must be "held out for sale" as animal feed'],
        ],
      },
      {
        type: 'list',
        heading: 'Critical VAT Nuances — Read These',
        items: [
          'Cooking slabs are zero-rated only if sold as food. If your website describes them as "cooking equipment" or "decorative objects," HMRC can apply the 20% standard rate. Keep your product descriptions food-first.',
          'Salt licks are zero-rated only if your labelling, invoicing, and website copy all clearly identify them as animal feed. The same product sold for human use loses the zero-rating immediately.',
          'Postponed VAT Accounting (PVA): import VAT on lamps (20%) is declared and recovered on the same VAT return, netting to zero for fully taxable businesses. Food and feed products attract 0% import VAT anyway.',
          'Making Tax Digital (MTD): mandatory for all VAT-registered businesses since April 2022. Keep digital records and file through MTD-compatible software (Xero, QuickBooks, Sage, FreeAgent). Late filing under the new points-based penalty system: 4 points = £200 fine per further late return.',
        ],
      },
    ],
  },
  {
    id: 'fines',
    title: 'Fines & Gotchas to Avoid',
    icon: '⚠️',
    summary: 'Trading Standards, labelling penalties, GDPR email marketing, electrical recall risk',
    content: [
      {
        type: 'table',
        heading: 'Fine & Penalty Reference Table',
        cols: ['Risk Area', 'Regulation', 'Maximum Penalty'],
        rows: [
          ['Misleading health claims (lamps)', 'Consumer Protection from Unfair Trading Regs 2008', 'Unlimited fine + 2 yrs imprisonment'],
          ['Selling non-UKCA/CE electrical goods', 'General Product Safety Regs 2005', 'Unlimited fine + 12 months imprisonment'],
          ['Food labelling breach (cooking slabs)', 'Food Information Regulations 2014', '£20,000 (magistrates); unlimited (Crown)'],
          ['Animal feed labelling breach', 'Animal Feed (England) Regulations 2010', 'Up to £5,000 per offence'],
          ['GDPR / email marketing without consent', 'UK GDPR + PECR 2003', 'Up to £17.5M or 4% global turnover'],
        ],
      },
      {
        type: 'list',
        heading: 'Food Labelling — Mandatory on Every Cooking Slab Package',
        items: [
          'Name of the food (e.g. "Himalayan Pink Salt Cooking Slab")',
          'Country of origin: "Product of Pakistan" — mandatory where omission would mislead',
          'Net quantity (weight in grams/kilograms)',
          'Name and address of the UK food business operator (your company)',
          'Nutritional information (mandatory for pre-packed food sold to consumers)',
          'Certificate of analysis from supplier confirming heavy metal levels (lead, cadmium, arsenic) are within FSA limits — Himalayan salt can contain trace heavy metals.',
        ],
      },
      {
        type: 'list',
        heading: 'Animal Feed Labelling — Mandatory on Every Salt Lick',
        items: [
          'Type of feed: e.g. "Complementary feed for horses/livestock"',
          'Species or category of animal intended for',
          'List of feed materials; crude analytical constituents (protein, fats, fibre, ash, sodium)',
          'Name and address of the UK feed business operator',
          'Batch or lot reference number',
          'You must register as a feed business operator with APHA before placing any animal feed on the market. Registration is free but mandatory under Regulation (EC) No 183/2005 (retained in UK law).',
        ],
      },
      {
        type: 'list',
        heading: 'GDPR Email Marketing Checklist',
        items: [
          'You need specific, freely given, informed, unambiguous opt-in consent before sending marketing emails. Pre-ticked boxes are invalid.',
          'Soft opt-in exception: you may email existing customers about similar products without fresh consent — this does NOT apply to new prospects or bought-in lists.',
          'Every marketing email must include: your business name, a physical address, and a clear one-click unsubscribe link.',
          'Honour unsubscribe requests within 24 hours.',
          'Keep records of when and how consent was obtained for the duration of the relationship plus at least 2–3 years.',
        ],
      },
    ],
  },
]

function AccordionSection({ section, isOpen, onToggle }) {
  return (
    <div style={{
      border: '1px solid #e0d0c6',
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 22px',
          background: isOpen ? '#b86040' : '#faf6f3',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '1.4rem' }}>{section.icon}</span>
          <div>
            <div style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '1.2rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: isOpen ? '#fff' : '#2a1a0e',
            }}>
              {section.title}
            </div>
            <div style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '0.95rem',
              color: isOpen ? 'rgba(255,255,255,0.8)' : '#888',
              marginTop: 2,
            }}>
              {section.summary}
            </div>
          </div>
        </div>
        <span style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: '1.5rem',
          color: isOpen ? '#fff' : '#b86040',
          transform: isOpen ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.2s',
          flexShrink: 0,
          marginLeft: 12,
        }}>
          +
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '24px 22px', background: '#fff' }}>
          {section.content.map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  )
}

function ContentBlock({ block }) {
  if (block.type === 'callout') {
    return (
      <div className="cta-box" style={{ marginBottom: 24 }}>
        <p style={{ margin: 0 }}>{block.text}</p>
      </div>
    )
  }

  if (block.type === 'table') {
    return (
      <div style={{ marginBottom: 24 }}>
        {block.heading && (
          <h5 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 12, fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {block.heading}
          </h5>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="sl-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>{block.cols.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ fontWeight: j === 0 ? 500 : 400, color: j === 0 ? '#2a1a0e' : undefined }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (block.type === 'list') {
    return (
      <div style={{ marginBottom: 24 }}>
        {block.heading && (
          <h5 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 10, fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {block.heading}
          </h5>
        )}
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#555', lineHeight: 1.7, marginBottom: 8 }}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (block.type === 'warning') {
    return (
      <div style={{ marginBottom: 24 }}>
        {block.heading && (
          <h5 style={{ fontFamily: 'Oswald, sans-serif', color: '#c0392b', marginBottom: 10, fontSize: '1rem', letterSpacing: '0.05em' }}>
            {block.heading}
          </h5>
        )}
        <div style={{ background: '#fff5f5', border: '1px solid #f5c6c0', borderRadius: 6, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#555' }}>{block.text}</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {block.banned.map((item, i) => (
              <li key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#c0392b', lineHeight: 1.7, marginBottom: 4 }}>
                ✗ {item}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: '#f0faf4', border: '1px solid #b2dfcc', borderRadius: 6, padding: '14px 18px' }}>
          <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#27ae60' }}>
            <strong>✓ Safe language:</strong> {block.allowed}
          </p>
        </div>
      </div>
    )
  }

  return null
}

export default function LegalitiesView() {
  const [openSection, setOpenSection] = useState('import')

  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>UK Legal Requirements</h2>
        <p className="sub">
          A direct importer of electrical goods and food-adjacent products operates across three
          separate legal regimes. This section maps the rules, the regulations they come from,
          and the consequences of non-compliance — so you can act on what matters most first.
        </p>
      </div>

      <div className="cta-box green" style={{ marginBottom: 28 }}>
        <p>
          <strong>Priority order for action.</strong> (1) Get APHA feed business operator
          registration done before your first salt lick sale — it is free and takes a few days.
          (2) Request IEC 60598 test certificates from your lamp supplier before your first
          import. (3) Ensure DCTS Form A paperwork is in place on every Pakistan shipment to
          claim the 0% duty rate. (4) Review all website copy for health claims — remove any
          reference to air purification or health benefits for salt lamps.
        </p>
      </div>

      <div style={{ marginBottom: 12 }}>
        {SECTIONS.map(section => (
          <AccordionSection
            key={section.id}
            section={section}
            isOpen={openSection === section.id}
            onToggle={() => setOpenSection(openSection === section.id ? null : section.id)}
          />
        ))}
      </div>

      <div className="bor" />

      <div className="summary-band">
        <h3>Compliance at a Glance</h3>
        <p>Four legal regimes, one business. Know which applies to each product line.</p>
        <div className="summary-stats">
          {[
            { num: '0%', label: 'Import duty (DCTS)' },
            { num: '£90k', label: 'VAT threshold' },
            { num: '2028', label: 'UKCA mandatory' },
            { num: 'Free', label: 'APHA feed registration' },
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
