import React from 'react'
import HonestAudit from './HonestAudit.jsx'
import VisionDocs from './VisionDocs.jsx'

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

export default function DiagnosisView() {
  return (
    <div>
      <SectionBridge
        title="Part 1 — Current Site Audit"
        sub="What's broken, why it matters, and what we keep"
      />
      <HonestAudit />
      <SectionBridge
        title="Part 2 — Vision &amp; Source Material"
        sub="Owner interviews, uploaded documents, and existing customer voice"
      />
      <VisionDocs />
    </div>
  )
}
