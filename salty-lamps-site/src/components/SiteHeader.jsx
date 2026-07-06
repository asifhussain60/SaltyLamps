import React from 'react'

export default function SiteHeader({ currentPage }) {
  return (
    <header className="site-header">
      <div>
        <div className="brand">
          Salty Lamps<span className="dot">.</span>
        </div>
        <div className="subtitle">Website Redesign Proposal &middot; Stoke-on-Trent, UK</div>
      </div>
      <div className="contact-info">
        <div><a href="tel:+441782970001">+44 (0) 1782 970001</a></div>
        <div><a href="mailto:info@saltylamps.co.uk">info@saltylamps.co.uk</a></div>
      </div>
    </header>
  )
}
