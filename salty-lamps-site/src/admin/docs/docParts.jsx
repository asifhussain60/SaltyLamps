// Shared building blocks for the in-admin documentation pages (Infrastructure,
// Technical Doc). Deliberately self-contained — no dependency on AdminApp internals —
// so the docs stay decoupled from the rest of the portal.
import React from 'react'

// A labelled diagram. `src` is a Vite-imported SVG URL from docs/diagrams/, so the
// exact same file backs both this page and the Markdown mirror in docs/*.md.
export function Figure({ src, alt, caption }) {
  return (
    <figure className="admin-doc__figure">
      <img src={src} alt={alt} width="940" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

// A coloured aside. tone: 'info' | 'warn' | 'ok'.
export function Callout({ tone = 'info', title, children }) {
  return (
    <div className={`admin-doc__callout admin-doc__callout--${tone}`}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  )
}
