import React, { useState } from 'react'

const logoImg = '/salty-lamp-logo.jpeg'

const CHIPS = [
  '10 Proposal Sections',
  'B2C first · B2B portal',
  'Organic-only traffic',
  '3-click purchase path',
  'React 18 + Tailwind v3',
  '16-week build plan',
  'UK → EU → US',
  'Warm & Earthy brand',
]

export default function Cover({ setCurrentPage }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="cover-page">
      <div className="cover-logo-wrap">
        {!imgError ? (
          <img
            src={logoImg}
            alt="Salty Lamps"
            className="cover-logo-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="cover-logo-fallback">SALTY LAMPS</div>
        )}
      </div>

      <h1>
        Website <span>Redesign</span> Proposal
      </h1>

      <p className="cover-sub">
        A React-powered, fully responsive digital experience built to rank on Google,
        captivate visitors, and convert in 3 clicks — grown entirely through organic traffic.
      </p>

      <div className="cover-meta">
        {CHIPS.map((chip) => (
          <span key={chip} className="chip">{chip}</span>
        ))}
      </div>

      <button
        className="btn-forward"
        style={{ fontSize: '1rem', padding: '12px 36px', letterSpacing: '0.06em' }}
        onClick={() => setCurrentPage(2)}
      >
        Begin Proposal &rarr;
      </button>
    </div>
  )
}
