// Shared admin UI primitives: the icon set and the themed confirm modal.
//
// Split out of AdminApp.jsx so the admin docs pages (src/admin/docs/*) can use the same
// themed <Confirm> instead of window.confirm. docParts.jsx is imported BY AdminApp.jsx
// (via MigrationDoc.jsx/TechnicalDoc.jsx), so Confirm/Icon cannot live in AdminApp.jsx
// itself without a circular import.

// ---- icons -----------------------------------------------------------------
// Dependency-free inline SVG icon set (no icon font / CDN) — line-style by default,
// with a 'solid' variant for higher-emphasis spots. Uses currentColor so tone comes
// from CSS (admin-icon--<token>), never a hardcoded hex.
export const ICON_PATHS = {
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  receipt: <><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></>,
  box: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><line x1="12" y1="13" x2="12" y2="21" /></>,
  warehouse: <><path d="M2 10l10-6 10 6" /><rect x="4" y="10" width="16" height="10" rx="1" /><line x1="9" y1="20" x2="9" y2="14" /><line x1="15" y1="20" x2="15" y2="14" /></>,
  barChart: <><line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="12" width="3" height="8" /><rect x="11" y="7" width="3" height="13" /><rect x="16" y="3" width="3" height="17" /></>,
  sliders: <><line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" /><line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="18" r="2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  trash: <><polyline points="4 7 20 7" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>,
  arrowRight: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  externalLink: <><path d="M14 3h7v7" /><line x1="21" y1="3" x2="10" y2="14" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></>,
  download: <><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><line x1="4" y1="20" x2="20" y2="20" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  truck: <><rect x="1" y="7" width="13" height="10" rx="1" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="6" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></>,
  mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  activity: <polyline points="3 12 8 12 10 6 14 18 16 12 21 12" />,
  trendingUp: <><polyline points="3 17 9 11 13 15 21 6" /><polyline points="14 6 21 6 21 13" /></>,
  star: <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />,
  tag: <><path d="M20.59 13.41L11 3.83A2 2 0 0 0 9.59 3.17L3 3v6.59a2 2 0 0 0 .66 1.41l9.59 9.59a2 2 0 0 0 2.83 0l4.51-4.51a2 2 0 0 0 0-2.83z" /><circle cx="7.5" cy="7.5" r="1.2" /></>,
  alertTriangle: <><path d="M12 2l10 18H2z" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></>,
  inbox: <><polyline points="3 9 8 9 10 12 14 12 16 9 21 9" /><path d="M3 9l2-6h14l2 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  list: <><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="0.8" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="0.8" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="0.8" fill="currentColor" stroke="none" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  columns: <><rect x="4" y="8" width="4" height="12" /><rect x="10" y="4" width="4" height="16" /><rect x="16" y="11" width="4" height="9" /></>,
  donut: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  info: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" /></>,
  undo: <><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 0 2.6-8.4L3 7" /></>,
  xCircle: <><circle cx="12" cy="12" r="9" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></>,
  book: <><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="1" /><rect x="3" y="13" width="18" height="7" rx="1" /><line x1="7" y1="7.5" x2="7.01" y2="7.5" /><line x1="7" y1="16.5" x2="7.01" y2="16.5" /></>,
  fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></>,
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  transfer: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
  toggleLeft: <><rect x="1" y="6" width="22" height="12" rx="6" /><circle cx="8" cy="12" r="3" fill="currentColor" stroke="none" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2.5 6 12 13 21.5 6" /></>,
  send: <><path d="M21 3L10.5 13.5" /><polygon points="21 3 14.5 21 10.5 13.5 3 9.5 21 3" /></>,
}

export function Icon({ name, size = 16, solid = false, tone, className = '' }) {
  const d = ICON_PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={solid ? 0 : 1.8}
      strokeLinecap="round" strokeLinejoin="round"
      className={`admin-icon ${tone ? `admin-icon--${tone}` : ''} ${className}`}
      aria-hidden="true"
    >
      {d}
    </svg>
  )
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>{danger && <Icon name="alertTriangle" tone="ember" className="admin-card-icon" />}{title}</h3>
        <p>{message}</p>
        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className={`admin-btn ${danger ? 'admin-btn--danger' : 'admin-btn--primary'}`} onClick={onConfirm}>
            {danger ? <Icon name="trash" size={14} /> : <Icon name="check" size={14} />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
