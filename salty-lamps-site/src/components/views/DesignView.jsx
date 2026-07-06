import React from 'react'
import HomepageJourney from './HomepageJourney.jsx'
import TechStack from './TechStack.jsx'
import SitemapStructure from './SitemapStructure.jsx'

function SectionBridge({ title, sub }) {
  return (
    <div style={{
      background: '#2a1a0e',
      padding: '18px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{
        fontFamily: 'Playfair Display, Georgia, serif',
        fontSize: '1.375rem',
        fontWeight: 700,
        color: '#d4956b',
        fontStyle: 'italic',
      }}>{title}</div>
      {sub && (
        <div style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '1rem',
          color: 'rgba(255,255,255,0.6)',
        }}>{sub}</div>
      )}
    </div>
  )
}

export default function DesignView() {
  return (
    <div>
      <SectionBridge
        title="Part 1 — Homepage &amp; The 3-Click Journey"
        sub="UX flow, section-by-section wireframe, and what must appear above the fold"
      />
      <HomepageJourney />
      <SectionBridge
        title="Part 2 — Technology Stack"
        sub="Every tool chosen for performance, SEO, and long-term cost"
      />
      <TechStack />
      <SectionBridge
        title="Part 3 — Site Blueprint"
        sub="Information architecture, URL structure, and codebase organisation"
      />
      <SitemapStructure />
    </div>
  )
}
