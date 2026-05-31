import React from 'react'
import SeoRanking from './SeoRanking.jsx'
import OrganicTraffic from './OrganicTraffic.jsx'

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

export default function GrowthView() {
  return (
    <div>
      <SectionBridge
        title="Part 1 — How Google Ranks Pages"
        sub="The four-layer ranking hierarchy and where the current site sits on each"
      />
      <SeoRanking />
      <SectionBridge
        title="Part 2 — Organic Traffic Strategy"
        sub="No paid ads. Four compounding channels and a month-by-month traffic timeline"
      />
      <OrganicTraffic />
    </div>
  )
}
