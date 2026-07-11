// Salty Lamps admin portal — dashboard, orders, catalog CRUD, inventory, reports.
//
// Rendered by App.jsx whenever the route starts with /admin. Same bundle, same site,
// its own chrome (sidebar + topbar). All data comes from the auth-gated /api/admin/*
// endpoints; the shared validation module (../../functions/lib/validation.mjs) gives
// the forms the exact rules the server enforces, so client and server never diverge.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  validateProduct,
  validateSku,
  poundsToPence,
  penceToPounds,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
  LOW_STOCK_THRESHOLD,
  FULFILMENT_STATUSES,
} from '../../functions/lib/validation.mjs'
import DonutChart from '../components/DonutChart.jsx'
import InfrastructureDoc from './docs/InfrastructureDoc.jsx'
import TechnicalDoc from './docs/TechnicalDoc.jsx'
import PricingDoc from './docs/PricingDoc.jsx'
import MigrationDoc from './docs/MigrationDoc.jsx'

// ---- small utilities ------------------------------------------------------

const gbp = pence =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format((Number(pence) || 0) / 100)

const dateFmt = s => {
  if (!s) return '—'
  const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z'))
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const monthLabel = ym => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

const shortMonthLabel = ym => {
  const m = Number(ym.split('-')[1])
  return new Date(2000, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
}

// Interpolates between two hex colors — used for a sequential (ordered-category) color
// scale, e.g. months within a year, rather than an arbitrary categorical palette.
function shadeBetween(hexA, hexB, t) {
  const a = hexA.match(/\w\w/g).map(h => parseInt(h, 16))
  const b = hexB.match(/\w\w/g).map(h => parseInt(h, 16))
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

// ---- icons -----------------------------------------------------------------
// Dependency-free inline SVG icon set (no icon font / CDN) — line-style by default,
// with a 'solid' variant for higher-emphasis spots. Uses currentColor so tone comes
// from CSS (admin-icon--<token>), never a hardcoded hex.
const ICON_PATHS = {
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
}

function Icon({ name, size = 16, solid = false, tone, className = '' }) {
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

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

function AdminLink({ href, className, children, onClick }) {
  return (
    <a
      href={href}
      className={className}
      onClick={e => {
        e.preventDefault()
        navigate(href)
        onClick?.(e)
      }}
    >
      {children}
    </a>
  )
}

async function api(path, { method = 'GET', body, isForm } = {}) {
  const opts = { method, credentials: 'include', headers: {} }
  if (body && !isForm) {
    opts.headers['content-type'] = 'application/json'
    opts.body = JSON.stringify(body)
  } else if (body && isForm) {
    opts.body = body
  }
  const res = await fetch(path, opts)
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      // Every admin endpoint always returns JSON, so a 200 with unparseable
      // body means this request never reached the admin API at all — most
      // likely the dev server is plain `vite dev` (no Cloudflare Functions)
      // rather than `wrangler pages dev`, which serves the SPA shell instead.
      const err = new Error(
        'The admin API did not respond with data. If you are running the storefront '
        + 'with plain `vite dev`, the admin backend needs `wrangler pages dev` instead '
        + '(it hosts the Cloudflare Pages Functions the admin API runs on).',
      )
      err.status = res.status
      throw err
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status}).`)
    err.status = res.status
    err.fields = data?.error?.fields || null
    throw err
  }
  return data
}

// Resize/compress in the browser before upload — a bandwidth win; the server still
// enforces the real size/type limits.
async function resizeImage(file, maxDim = 1600, quality = 0.82) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return file // let the server reject it
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name, { type })
}

function usePageData(fetcher, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoFetcher = useCallback(fetcher, deps)
  const load = useCallback(() => {
    let alive = true
    setState(s => ({ ...s, loading: true, error: null }))
    memoFetcher()
      .then(d => alive && setState({ loading: false, error: null, data: d }))
      .catch(e => alive && setState({ loading: false, error: e, data: null }))
    return () => {
      alive = false
    }
  }, [memoFetcher])
  useEffect(() => load(), [load])
  return { ...state, reload: load, setData: d => setState(s => ({ ...s, data: d })) }
}

// ---- shared presentational bits ------------------------------------------

function Loading() {
  return <div className="admin-state admin-state--loading">Loading…</div>
}

function ErrorState({ error, onRetry }) {
  if (error?.status === 401 || error?.status === 403) {
    return (
      <div className="admin-state admin-state--auth">
        <h2>Session expired</h2>
        <p>Please sign in again to continue.</p>
        <button className="admin-btn" onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
  return (
    <div className="admin-state admin-state--error">
      <Icon name="alertTriangle" size={20} className="admin-state-icon" />
      <p>{error?.message || 'Something went wrong.'}</p>
      {onRetry && <button className="admin-btn" onClick={onRetry}>Try again</button>}
    </div>
  )
}

function EmptyState({ children }) {
  return (
    <div className="admin-state admin-state--empty">
      <Icon name="inbox" size={22} tone="muted" className="admin-state-icon" />
      <div>{children}</div>
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="admin-search">
      <Icon name="search" size={15} tone="muted" className="admin-search-icon" />
      <input className="admin-input admin-search-input" placeholder={placeholder} value={value} onChange={onChange} />
    </div>
  )
}

function StatusBadge({ value, kind = 'payment' }) {
  return <span className={`admin-badge admin-badge--${kind}-${value}`}>{value}</span>
}

const PAGE_SIZE = 20

function paginate(items, page) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  return {
    page: clampedPage,
    pageCount,
    pageItems: items.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE),
  }
}

function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null
  return (
    <div className="admin-pagination">
      <button className="admin-btn admin-btn--ghost" disabled={page === 0} onClick={() => onChange(page - 1)}>← Previous</button>
      <span className="admin-muted">Page {page + 1} of {pageCount}</span>
      <button className="admin-btn admin-btn--ghost" disabled={page === pageCount - 1} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  )
}

function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
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

function Field({ label, error, children, hint }) {
  return (
    <label className={`admin-field ${error ? 'admin-field--error' : ''}`}>
      <span className="admin-field-label">{label}</span>
      {children}
      {hint && !error && <span className="admin-field-hint">{hint}</span>}
      {error && <span className="admin-field-error">{error}</span>}
    </label>
  )
}

// ---- dashboard ------------------------------------------------------------

// Small filled-area trend backdrop for a KPI card. Purely decorative context
// (the number is the real value) so it degrades silently when there's no series.
function Sparkline({ series, width = 120, height = 32 }) {
  if (!series?.length) return null
  const max = Math.max(...series.map(d => d.revenue_pence), 1)
  const stepX = width / (series.length - 1 || 1)
  const pts = series.map((d, i) => [i * stepX, height - (d.revenue_pence / max) * height])
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg className="admin-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} className="admin-sparkline-area" />
      <path d={line} className="admin-sparkline-line" />
    </svg>
  )
}

// current as a % of prior — prior=0 reads as "100% (new)" rather than a divide-by-zero.
function pctVs(current, prior) {
  if (prior > 0) return Math.round((current / prior) * 100)
  return current > 0 ? 100 : 0
}

function ringTone(pct) {
  if (pct >= 100) return 'hi'
  if (pct >= 70) return 'md'
  return 'lo'
}

function KpiCard({ label, value, current, prior, compareLabel }) {
  const hasComparison = prior != null
  const pct = hasComparison ? Math.min(pctVs(current, prior), 200) : null
  return (
    <div className="admin-kpi-card">
      <span className="admin-kpi-label">{label}</span>
      <div className="admin-kpi-ring-row">
        {hasComparison && <DonutChart pct={pct} color={ringTone(pct)} size={56} />}
        <div className="admin-kpi-ring-text">
          <span className="admin-kpi-value">{value}</span>
          {hasComparison && <span className="admin-kpi-compare">vs {compareLabel}</span>}
        </div>
      </div>
    </div>
  )
}

// Smooth gradient-filled area/line chart. Shared by Dashboard and Reports.
function SalesBars({ series }) {
  if (!series?.length) return <EmptyState>No sales in this window yet.</EmptyState>
  const W = 640
  const H = 200
  const padTop = 16
  const padBottom = 26
  const padX = 6 // keeps the endpoint dots (r=3 + 2px stroke) from clipping at the viewBox edge
  const max = Math.max(...series.map(d => d.revenue_pence), 1)
  const innerH = H - padTop - padBottom
  const stepX = (W - padX * 2) / (series.length - 1 || 1)
  const pts = series.map((d, i) => ({
    x: padX + i * stepX,
    y: padTop + innerH - (d.revenue_pence / max) * innerH,
    d,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - padBottom} L${pts[0].x.toFixed(1)},${H - padBottom} Z`
  const gridYs = [0.25, 0.5, 0.75].map(f => padTop + innerH * f)
  const labelIdx = [0, Math.floor((pts.length - 1) / 2), pts.length - 1]

  return (
    <svg className="admin-trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily sales">
      <defs>
        <linearGradient id="admin-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="admin-trend-stop-start" />
          <stop offset="100%" className="admin-trend-stop-end" />
        </linearGradient>
      </defs>
      {gridYs.map(y => <line key={y} x1="0" y1={y} x2={W} y2={y} className="admin-trend-grid" />)}
      <path d={area} className="admin-trend-area" />
      <path d={line} className="admin-trend-line" />
      {pts.map((p, i) => (
        <circle key={p.d.day} cx={p.x} cy={p.y} r="3" className="admin-trend-dot">
          <title>{`${p.d.day}: ${gbp(p.d.revenue_pence)} (${p.d.orders} orders)`}</title>
        </circle>
      ))}
      {labelIdx.map(i => (
        <text
          key={i}
          x={Math.min(Math.max(pts[i].x, 20), W - 20)}
          y={H - 6}
          textAnchor="middle"
          className="admin-trend-label"
        >
          {dateFmt(pts[i].d.day)}
        </text>
      ))}
    </svg>
  )
}

function StockAlertBar({ low, out }) {
  const total = low + out
  if (total === 0) return <p className="admin-muted">All stock levels healthy.</p>
  const W = 100
  const outW = (out / total) * W
  const lowW = (low / total) * W
  return (
    <div className="admin-stock-alert">
      <svg className="admin-stock-bar" viewBox={`0 0 ${W} 14`} preserveAspectRatio="none" role="img" aria-label="Stock alerts">
        {out > 0 && <rect x="0" y="0" width={outW} height="14" className="admin-stock-seg admin-stock-seg--out" />}
        {low > 0 && <rect x={outW} y="0" width={lowW} height="14" className="admin-stock-seg admin-stock-seg--low" />}
      </svg>
      <div className="admin-stock-legend">
        {out > 0 && <span className="admin-stock-legend-item"><i className="admin-dot admin-dot--out" />{out} out of stock</span>}
        {low > 0 && <span className="admin-stock-legend-item"><i className="admin-dot admin-dot--low" />{low} low stock</span>}
      </div>
    </div>
  )
}

const FULFIL_STAGES = ['unfulfilled', 'packed', 'shipped', 'delivered']
const FULFIL_LABELS = { unfulfilled: 'Unfulfilled', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered' }

// Share of all paid orders currently at each fulfilment stage — same segmented-bar language as
// StockAlertBar above, colored to match the existing fulfilment StatusBadge palette.
function FulfilmentFunnelBar({ breakdown }) {
  const total = FULFIL_STAGES.reduce((sum, s) => sum + (breakdown[s] || 0), 0)
  if (total === 0) return <p className="admin-muted">No fulfilled orders yet.</p>
  const W = 100
  let x = 0
  const segs = FULFIL_STAGES.map(stage => {
    const count = breakdown[stage] || 0
    const seg = { stage, count, x, w: (count / total) * W }
    x += seg.w
    return seg
  })
  return (
    <div className="admin-funnel">
      <svg className="admin-funnel-bar" viewBox={`0 0 ${W} 14`} preserveAspectRatio="none" role="img" aria-label="Fulfilment breakdown">
        {segs.map(s => s.count > 0 && (
          <rect key={s.stage} x={s.x} y="0" width={s.w} height="14" className={`admin-funnel-seg admin-funnel-seg--${s.stage}`} />
        ))}
      </svg>
      <div className="admin-funnel-legend">
        {segs.map(s => s.count > 0 && (
          <span key={s.stage} className="admin-funnel-legend-item">
            <i className={`admin-dot admin-dot--${s.stage}`} />{s.count} {FULFIL_LABELS[s.stage].toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  )
}

// Compact stage indicator for a single order — filled dots up to its current fulfilment stage.
function FulfilmentStepper({ status }) {
  const reached = FULFIL_STAGES.indexOf(status)
  return (
    <span className="admin-stepper" title={FULFIL_LABELS[status] || status}>
      {FULFIL_STAGES.map((s, i) => (
        <span key={s} className={`admin-stepper-dot ${i <= reached ? `admin-stepper-dot--${s}` : ''}`} />
      ))}
    </span>
  )
}

function TopProductsBar({ products }) {
  if (!products?.length) return null
  const max = Math.max(...products.map(p => p.revenue_pence), 1)
  return (
    <div className="admin-hbar-chart">
      {products.map(p => (
        <div className="admin-hbar-row" key={p.name}>
          <span className="admin-hbar-label" title={p.name}>{p.name}</span>
          <div className="admin-hbar-track">
            <div className="admin-hbar-fill" style={{ width: `${(p.revenue_pence / max) * 100}%` }} />
          </div>
          <span className="admin-hbar-value">{gbp(p.revenue_pence)}</span>
        </div>
      ))}
    </div>
  )
}

function ActivityRow({ label, value, series }) {
  return (
    <li className="admin-activity-row">
      {series ? <Sparkline series={series} width={60} height={24} /> : <span className="admin-activity-spacer" />}
      <span className="admin-activity-text"><strong>{label}</strong> : {value}</span>
    </li>
  )
}

// "Store activity" — a compact glance list, real store data only (no invented analytics).
function ActivityList({ data, last7 }) {
  const a = data.activity
  return (
    <ul className="admin-activity-list">
      <ActivityRow label="Orders today" value={data.orders.today} series={last7} />
      <ActivityRow label="Orders this week" value={data.orders.week} series={last7} />
      <ActivityRow label="Units sold today" value={a.units_today} />
      <ActivityRow label="New customers this week" value={a.new_customers_week} />
      <ActivityRow label="Avg items per order (7d)" value={a.avg_items_per_order_week} />
    </ul>
  )
}

function Dashboard() {
  const { loading, error, data, reload } = usePageData(() => api('/api/admin/stats'))
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const series = data.sales_series
  const last7 = series.slice(-7)
  const weekAvgPence = data.orders.week > 0 ? Math.round(data.revenue.week_pence / data.orders.week) : 0

  return (
    <>
      <div className="admin-kpi-row">
        <KpiCard
          label="Revenue today" value={gbp(data.revenue.today_pence)}
          current={data.revenue.today_pence} prior={data.comparisons.yesterday_pence} compareLabel="yesterday"
        />
        <KpiCard
          label="Revenue this week" value={gbp(data.revenue.week_pence)}
          current={data.revenue.week_pence} prior={data.comparisons.previous_week_pence} compareLabel="last week"
        />
        <KpiCard
          label="Revenue this month" value={gbp(data.revenue.month_pence)}
          current={data.revenue.month_pence} prior={data.comparisons.previous_month_pence} compareLabel="last month"
        />
        <KpiCard
          label="Avg order (7d)" value={gbp(weekAvgPence)}
          current={weekAvgPence} prior={data.average_order_pence} compareLabel="all-time avg"
        />
      </div>

      <div className="admin-chart-row">
        <section className="admin-card">
          <h2><Icon name="trendingUp" tone="amber" className="admin-card-icon" />Sales — last 14 days</h2>
          <SalesBars series={series} />
        </section>

        <section className="admin-card">
          <h2><Icon name="activity" tone="amber" className="admin-card-icon" />Store activity</h2>
          <ActivityList data={data} last7={last7} />
        </section>
      </div>

      <div className="admin-two-col">
        <section className="admin-card">
          <h2><Icon name="sliders" tone="amber" className="admin-card-icon" />Operations</h2>
          <h3 className="admin-subhead"><Icon name="truck" size={13} tone="blue" className="admin-card-icon" />Fulfilment</h3>
          <FulfilmentFunnelBar breakdown={data.fulfilment_breakdown} />
          <h3 className="admin-subhead admin-subhead--spaced"><Icon name="warehouse" size={13} tone="ember" className="admin-card-icon" />Stock</h3>
          <StockAlertBar low={data.stock.low_stock} out={data.stock.out_of_stock} />
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h2><Icon name="receipt" tone="amber" className="admin-card-icon" />Recent orders</h2>
            <AdminLink href="/admin/orders" className="admin-link">View all<Icon name="arrowRight" size={13} className="admin-link-icon" /></AdminLink>
          </div>
          {data.recent_orders.length === 0 ? (
            <EmptyState>No orders yet.</EmptyState>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.recent_orders.map(o => (
                  <tr key={o.id} className="admin-row-link" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                    <td>{dateFmt(o.created_at)}</td>
                    <td>{o.customer_email || '—'}</td>
                    <td>{gbp(o.amount_total_pence)}</td>
                    <td><FulfilmentStepper status={o.fulfilment_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="admin-card">
        <h2><Icon name="star" tone="amber" className="admin-card-icon" />Top products</h2>
        {data.top_products.length === 0 ? (
          <EmptyState>No sales yet.</EmptyState>
        ) : (
          <>
            <TopProductsBar products={data.top_products} />
            <table className="admin-table">
              <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.top_products.map(p => (
                  <tr key={p.name}><td>{p.name}</td><td>{p.qty}</td><td>{gbp(p.revenue_pence)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  )
}

// ---- orders ---------------------------------------------------------------

// ---- shared grouped-breakdown chart views (Orders: By month / By year) ---------

function HBarBreakdown({ items }) {
  const max = Math.max(...items.map(it => it.revenue_pence), 1)
  return (
    <div className="admin-hbar-chart">
      {items.map(it => (
        <div className="admin-hbar-row" key={it.key}>
          <span className="admin-hbar-label">{it.label}</span>
          <div className="admin-hbar-track">
            <div className="admin-hbar-fill" style={{ width: `${(it.revenue_pence / max) * 100}%` }} />
          </div>
          <span className="admin-hbar-value">{gbp(it.revenue_pence)}</span>
        </div>
      ))}
    </div>
  )
}

function ColumnChart({ items }) {
  const W = 640
  const H = 200
  const padTop = 10
  const padBottom = 30
  const gap = 8
  const max = Math.max(...items.map(it => it.revenue_pence), 1)
  const bw = (W - gap * (items.length - 1)) / items.length
  return (
    <svg className="admin-column-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue breakdown">
      {items.map((it, i) => {
        const h = Math.max(2, ((H - padTop - padBottom) * it.revenue_pence) / max)
        const x = i * (bw + gap)
        return (
          <g key={it.key}>
            <rect x={x} y={H - padBottom - h} width={bw} height={h} rx="3" className="admin-column-bar">
              <title>{`${it.label}: ${gbp(it.revenue_pence)} (${it.orders} orders)`}</title>
            </rect>
            <text x={x + bw / 2} y={H - padBottom + 14} textAnchor="middle" className="admin-column-label">
              {it.axisLabel}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const DONUT_FROM = '#d88a35' // var(--amber)
const DONUT_TO = '#9b4328' // var(--ember)

function BreakdownDonut({ items }) {
  const total = items.reduce((sum, it) => sum + it.revenue_pence, 0)
  if (total === 0) return <p className="admin-muted">No revenue in this window yet.</p>

  const size = 160
  const strokeWidth = size * 0.16
  const r = size / 2 - strokeWidth / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  const shade = i => shadeBetween(DONUT_FROM, DONUT_TO, items.length <= 1 ? 0 : i / (items.length - 1))

  return (
    <div className="admin-donut-breakdown">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Revenue breakdown">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--paper)" strokeWidth={strokeWidth} />
        {items.map((it, i) => {
          const frac = it.revenue_pence / total
          const len = frac * circ
          const dashOffset = -offset
          offset += len
          return (
            <circle
              key={it.key}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={shade(i)} strokeWidth={strokeWidth}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            >
              <title>{`${it.label}: ${gbp(it.revenue_pence)} (${Math.round(frac * 100)}%)`}</title>
            </circle>
          )
        })}
      </svg>
      <ul className="admin-donut-legend">
        {items.map((it, i) => (
          <li key={it.key} className="admin-donut-legend-item">
            <i className="admin-donut-swatch" style={{ background: shade(i) }} />
            <span>{it.axisLabel}</span>
            <strong>{gbp(it.revenue_pence)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GroupedBreakdown({ items, chartMode, columnLabel }) {
  if (items.length === 0) return <EmptyState>No paid orders yet.</EmptyState>
  return (
    <section className="admin-card">
      {chartMode === 'bars' && <HBarBreakdown items={items} />}
      {chartMode === 'columns' && <ColumnChart items={items} />}
      {chartMode === 'donut' && <BreakdownDonut items={items} />}
      <table className="admin-table">
        <thead><tr><th>{columnLabel}</th><th>Orders</th><th>Revenue</th></tr></thead>
        <tbody>
          {items.map(it => (
            <tr key={it.key}><td>{it.label}</td><td>{it.orders}</td><td>{gbp(it.revenue_pence)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// Paid orders grouped by calendar month, scoped to one year at a time — order volume
// made visual (same chart language as the dashboard), not just another table of numbers.
function OrdersByMonth({ chartMode }) {
  const { loading, error, data, reload } = usePageData(() => api('/api/admin/orders/by-month'))
  const [year, setYear] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (data.months.length === 0) return <EmptyState>No paid orders yet.</EmptyState>

  const years = [...new Set(data.months.map(m => m.month.slice(0, 4)))].sort().reverse()
  const activeYear = years.includes(year) ? year : years[0]
  const items = data.months
    .filter(m => m.month.startsWith(activeYear))
    .map(m => ({ key: m.month, label: monthLabel(m.month), axisLabel: shortMonthLabel(m.month), orders: m.orders, revenue_pence: m.revenue_pence }))

  return (
    <>
      <div className="admin-filters">
        <select className="admin-input admin-input--year" value={activeYear} onChange={e => setYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <GroupedBreakdown items={items} chartMode={chartMode} columnLabel="Month" />
    </>
  )
}

// Paid orders grouped by calendar year — inherently compact, no filter needed.
function OrdersByYear({ chartMode }) {
  const { loading, error, data, reload } = usePageData(() => api('/api/admin/orders/by-year'))
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (data.years.length === 0) return <EmptyState>No paid orders yet.</EmptyState>

  const items = data.years.map(y => ({ key: y.year, label: y.year, axisLabel: y.year, orders: y.orders, revenue_pence: y.revenue_pence }))
  return <GroupedBreakdown items={items} chartMode={chartMode} columnLabel="Year" />
}

function OrdersList() {
  const [status, setStatus] = useState('')
  const [fulfilment, setFulfilment] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [view, setView] = useState('list') // 'list' | 'month' | 'year'
  const [chartMode, setChartMode] = useState('bars') // 'bars' | 'columns' | 'donut'
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (fulfilment) qs.set('fulfilment', fulfilment)
  if (q) qs.set('q', q)
  qs.set('limit', PAGE_SIZE)
  qs.set('offset', page * PAGE_SIZE)
  const { loading, error, data, reload } = usePageData(
    () => api(`/api/admin/orders?${qs.toString()}`),
    [status, fulfilment, q, page],
  )

  const setFilter = (setter) => e => { setter(e.target.value); setPage(0) }

  return (
    <>
      <div className="admin-filters">
        <SearchInput placeholder="Search email or order id…" value={q} onChange={setFilter(setQ)} />
        <select className="admin-input" value={status} onChange={setFilter(setStatus)}>
          <option value="">All payments</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="admin-input" value={fulfilment} onChange={setFilter(setFulfilment)}>
          <option value="">All fulfilment</option>
          {FULFILMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="admin-view-toggle">
        <button className={`admin-toggle-btn ${view === 'list' ? 'admin-toggle-btn--active' : ''}`} onClick={() => setView('list')}><Icon name="list" size={14} />List</button>
        <button className={`admin-toggle-btn ${view === 'month' ? 'admin-toggle-btn--active' : ''}`} onClick={() => setView('month')}><Icon name="calendar" size={14} />By month</button>
        <button className={`admin-toggle-btn ${view === 'year' ? 'admin-toggle-btn--active' : ''}`} onClick={() => setView('year')}><Icon name="calendar" size={14} />By year</button>
        {view !== 'list' && (
          <div className="admin-chart-mode-toggle">
            <button className={`admin-toggle-btn ${chartMode === 'bars' ? 'admin-toggle-btn--active' : ''}`} onClick={() => setChartMode('bars')}><Icon name="barChart" size={14} />Bars</button>
            <button className={`admin-toggle-btn ${chartMode === 'columns' ? 'admin-toggle-btn--active' : ''}`} onClick={() => setChartMode('columns')}><Icon name="columns" size={14} />Columns</button>
            <button className={`admin-toggle-btn ${chartMode === 'donut' ? 'admin-toggle-btn--active' : ''}`} onClick={() => setChartMode('donut')}><Icon name="donut" size={14} />Donut</button>
          </div>
        )}
      </div>

      {view === 'month' ? (
        <OrdersByMonth chartMode={chartMode} />
      ) : view === 'year' ? (
        <OrdersByYear chartMode={chartMode} />
      ) : loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.orders.length === 0 ? (
        <EmptyState>No orders match.</EmptyState>
      ) : (
        <section className="admin-card">
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Fulfilment</th></tr>
            </thead>
            <tbody>
              {data.orders.map(o => (
                <tr key={o.id} className="admin-row-link" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                  <td>{dateFmt(o.created_at)}</td>
                  <td>{o.customer_email || '—'}</td>
                  <td>{o.item_count}</td>
                  <td>{gbp(o.amount_total_pence)}</td>
                  <td><StatusBadge value={o.status} kind="payment" /></td>
                  <td><StatusBadge value={o.fulfilment_status} kind="fulfilment" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="admin-muted">{data.total} order{data.total === 1 ? '' : 's'} total</p>
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(data.total / PAGE_SIZE))} onChange={setPage} />
        </section>
      )}
    </>
  )
}

function OrderDetail({ id }) {
  const { loading, error, data, reload } = usePageData(() => api(`/api/admin/orders/${id}`), [id])
  const [fulfil, setFulfil] = useState('')
  const [tracking, setTracking] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'refunded' | 'cancelled' | null

  useEffect(() => {
    if (data?.order) {
      setFulfil(data.order.fulfilment_status)
      setTracking(data.order.tracking_number || '')
    }
  }, [data])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { order, items } = data

  const patch = async payload => {
    setSaving(true)
    setSaveErr(null)
    try {
      await api(`/api/admin/orders/${id}`, { method: 'PATCH', body: payload })
      await reload()
    } catch (e) {
      setSaveErr(e)
    } finally {
      setSaving(false)
      setConfirm(null)
    }
  }

  return (
    <>
      <AdminLink href="/admin/orders" className="admin-link">← All orders</AdminLink>
      <div className="admin-two-col">
        <section className="admin-card">
          <h2><Icon name="box" tone="amber" className="admin-card-icon" />Items</h2>
          <table className="admin-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Line</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.sku_id}>
                  <td>{it.name}{it.variant_label ? ` — ${it.variant_label}` : ''}</td>
                  <td>{it.sku}</td>
                  <td>{it.quantity}</td>
                  <td>{gbp(it.unit_price_pence * it.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="admin-total">Total: <strong>{gbp(order.amount_total_pence)}</strong></p>
        </section>

        <section className="admin-card">
          <h2><Icon name="mapPin" tone="amber" className="admin-card-icon" />Customer & shipping</h2>
          <p className="admin-kv"><span>Email</span><strong>{order.customer_email || '—'}</strong></p>
          <address className="admin-address">
            {order.ship_name && <div>{order.ship_name}</div>}
            {order.ship_line1 && <div>{order.ship_line1}</div>}
            {order.ship_line2 && <div>{order.ship_line2}</div>}
            {(order.ship_city || order.ship_postcode) && <div>{[order.ship_city, order.ship_postcode].filter(Boolean).join(', ')}</div>}
            {order.ship_country && <div>{order.ship_country}</div>}
            {!order.ship_line1 && <div className="admin-muted">No shipping address on file.</div>}
          </address>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <h2><Icon name="truck" tone="amber" className="admin-card-icon" />Fulfilment</h2>
          <div className="admin-badges">
            <StatusBadge value={order.status} kind="payment" />
            <StatusBadge value={order.fulfilment_status} kind="fulfilment" />
          </div>
        </div>
        {saveErr && <ErrorState error={saveErr} />}
        <div className="admin-inline-form">
          <Field label="Fulfilment status">
            <select className="admin-input" value={fulfil} onChange={e => setFulfil(e.target.value)}>
              {FULFILMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Tracking number">
            <input className="admin-input" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Optional" />
          </Field>
          <button
            className="admin-btn admin-btn--primary"
            disabled={saving}
            onClick={() => patch({ fulfilment_status: fulfil, tracking_number: tracking })}
          >
            <Icon name="check" size={15} />{saving ? 'Saving…' : 'Save fulfilment'}
          </button>
        </div>
        <div className="admin-danger-row">
          {order.status === 'paid' && (
            <>
              <button className="admin-btn admin-btn--danger" disabled={saving} onClick={() => setConfirm('refunded')}><Icon name="undo" size={14} />Refund order</button>
              <button className="admin-btn admin-btn--ghost" disabled={saving} onClick={() => setConfirm('cancelled')}><Icon name="xCircle" size={14} />Mark cancelled</button>
            </>
          )}
        </div>
      </section>

      <Confirm
        open={confirm === 'refunded'}
        danger
        title="Refund this order?"
        message="This issues a real Stripe refund to the customer and cannot be undone."
        confirmLabel="Refund"
        onConfirm={() => patch({ status: 'refunded' })}
        onCancel={() => setConfirm(null)}
      />
      <Confirm
        open={confirm === 'cancelled'}
        danger
        title="Mark this order cancelled?"
        message="This marks the order cancelled in your records. It does not refund any payment."
        confirmLabel="Mark cancelled"
        onConfirm={() => patch({ status: 'cancelled' })}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}

// ---- products list --------------------------------------------------------

function ProductsList() {
  const { loading, error, data, reload } = usePageData(() => api('/api/admin/products'))
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [actionErr, setActionErr] = useState(null)
  const [q, setQ] = useState('')
  const [visibility, setVisibility] = useState('')
  const [page, setPage] = useState(0)

  const doDelete = async id => {
    setActionErr(null)
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      await reload()
    } catch (e) {
      setActionErr(e)
      setConfirmDelete(null)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const needle = q.trim().toLowerCase()
  const filtered = data.products.filter(p => {
    if (visibility === 'visible' && !p.visible) return false
    if (visibility === 'hidden' && p.visible) return false
    if (needle && !p.name.toLowerCase().includes(needle)) return false
    return true
  })
  const { page: shownPage, pageCount, pageItems } = paginate(filtered, page)

  return (
    <>
      <div className="admin-card-head admin-card-head--bare">
        <p className="admin-muted">{filtered.length} of {data.products.length} products</p>
        <AdminLink href="/admin/products/new" className="admin-btn admin-btn--primary"><Icon name="plus" size={15} />New product</AdminLink>
      </div>
      <div className="admin-filters">
        <SearchInput
          placeholder="Search products…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(0) }}
        />
        <select className="admin-input" value={visibility} onChange={e => { setVisibility(e.target.value); setPage(0) }}>
          <option value="">All products</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      {actionErr && <ErrorState error={actionErr} />}
      <section className="admin-card">
        {pageItems.length === 0 ? (
          <EmptyState>No products match.</EmptyState>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th></th><th>Name</th><th>SKUs</th><th>Price</th><th>Visible</th><th></th></tr>
            </thead>
            <tbody>
              {pageItems.map(p => {
                const prices = p.skus.map(s => s.price_pence)
                const priceLabel = prices.length
                  ? prices.every(v => v === prices[0])
                    ? gbp(prices[0])
                    : `${gbp(Math.min(...prices))}–${gbp(Math.max(...prices))}`
                  : '—'
                return (
                  <tr key={p.id}>
                    <td>{p.image ? <img className="admin-thumb" src={p.image} alt="" /> : <div className="admin-thumb admin-thumb--empty" />}</td>
                    <td><AdminLink href={`/admin/products/${p.id}`} className="admin-link">{p.name}</AdminLink></td>
                    <td>{p.skus.length}</td>
                    <td>{priceLabel}</td>
                    <td>{p.visible ? 'Yes' : <span className="admin-muted">Hidden</span>}</td>
                    <td className="admin-cell-actions">
                      <AdminLink href={`/admin/products/${p.id}`} className="admin-link">Edit</AdminLink>
                      <button className="admin-link admin-link--danger" onClick={() => setConfirmDelete(p)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <Pagination page={shownPage} pageCount={pageCount} onChange={setPage} />
      </section>
      <Confirm
        open={!!confirmDelete}
        danger
        title="Delete this product?"
        message={`"${confirmDelete?.name}" and its SKUs will be removed. Products that appear on past orders can't be deleted — hide them instead.`}
        confirmLabel="Delete"
        onConfirm={() => doDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}

// ---- product edit / create ------------------------------------------------

const blankSku = () => ({ sku: '', variant_label: '', price: '', track_mode: 'quantity', quantity: '0', in_stock: true })

function ProductEdit({ id }) {
  const isNew = id === 'new'
  const { loading, error, data, reload } = usePageData(
    () => (isNew ? Promise.resolve({ products: [] }) : api('/api/admin/products')),
    [id],
  )
  const [form, setForm] = useState(null)
  const [skus, setSkus] = useState([])
  const [originalSkuIds, setOriginalSkuIds] = useState([])
  const [errs, setErrs] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (isNew) {
      setForm({ name: '', slug: '', description: '', categories: '', tags: '', visible: true, image: '' })
      setSkus([blankSku()])
      setOriginalSkuIds([])
      return
    }
    const p = data?.products?.find(x => x.id === id)
    if (p) {
      setForm({
        name: p.name, slug: p.slug, description: p.description || '',
        categories: p.categories || '', tags: p.tags || '', visible: !!p.visible, image: p.image || '',
      })
      setSkus(p.skus.map(s => ({
        id: s.id, sku: s.sku, variant_label: s.variant_label || '',
        price: String(penceToPounds(s.price_pence)), track_mode: s.track_mode,
        quantity: s.quantity == null ? '0' : String(s.quantity), in_stock: !!s.in_stock,
      })))
      setOriginalSkuIds(p.skus.map(s => s.id))
    }
  }, [data, id, isNew])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!isNew && !form) return <EmptyState>Product not found.</EmptyState>
  if (!form) return <Loading />

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setSku = (i, k, v) => setSkus(list => list.map((s, j) => (j === i ? { ...s, [k]: v } : s)))

  const onPickImage = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES * 4) {
      setErrs(x => ({ ...x, image: 'That file is far too large. Choose an image under 2 MB.' }))
      return
    }
    setErrs(x => ({ ...x, image: undefined }))
    const resized = await resizeImage(file)
    setImageFile(resized)
    setImagePreview(URL.createObjectURL(resized))
  }

  const uploadImageTo = async productId => {
    if (!imageFile) return
    const fd = new FormData()
    fd.append('image', imageFile)
    setUploading(true)
    try {
      const res = await api(`/api/admin/products/${productId}/image`, { method: 'POST', body: fd, isForm: true })
      setField('image', res.image)
      setImageFile(null)
      setImagePreview('')
    } finally {
      setUploading(false)
    }
  }

  const validateAll = () => {
    const next = {}
    const pv = validateProduct(form)
    Object.assign(next, pv.errors)
    skus.forEach((s, i) => {
      const sv = validateSku(s)
      if (!sv.ok) next[`sku_${i}`] = Object.values(sv.errors).join(' ')
    })
    setErrs(next)
    return Object.keys(next).length === 0
  }

  const save = async () => {
    if (!validateAll()) return
    setSaving(true)
    setSaveErr(null)
    try {
      if (isNew) {
        const res = await api('/api/admin/products', {
          method: 'POST',
          body: { product: form, skus },
        })
        if (imageFile) await uploadImageTo(res.id)
        navigate(`/admin/products/${res.id}`)
        return
      }
      // Existing: update product, then reconcile SKUs.
      await api(`/api/admin/products/${id}`, { method: 'PATCH', body: form })
      for (const s of skus) {
        if (s.id) await api(`/api/admin/skus/${s.id}`, { method: 'PATCH', body: s })
        else await api(`/api/admin/products/${id}/skus`, { method: 'POST', body: s })
      }
      const keptIds = skus.filter(s => s.id).map(s => s.id)
      for (const oldId of originalSkuIds) {
        if (!keptIds.includes(oldId)) await api(`/api/admin/skus/${oldId}`, { method: 'DELETE' })
      }
      if (imageFile) await uploadImageTo(id)
      await reload()
      setSaveErr({ message: 'Saved.', ok: true })
    } catch (e) {
      setSaveErr(e)
    } finally {
      setSaving(false)
    }
  }

  const currentImage = imagePreview || form.image

  return (
    <>
      <AdminLink href="/admin/products" className="admin-link">← All products</AdminLink>
      <h1 className="admin-page-title">{isNew ? 'New product' : form.name || 'Edit product'}</h1>
      {saveErr && (saveErr.ok
        ? <div className="admin-state admin-state--ok">{saveErr.message}</div>
        : <ErrorState error={saveErr} />)}

      <div className="admin-two-col">
        <section className="admin-card">
          <h2><Icon name="info" tone="amber" className="admin-card-icon" />Details</h2>
          <Field label="Name" error={errs.name}>
            <input className="admin-input" value={form.name} onChange={e => setField('name', e.target.value)} />
          </Field>
          <Field label="Slug" error={errs.slug} hint="Leave blank to derive from the name.">
            <input className="admin-input" value={form.slug} onChange={e => setField('slug', e.target.value)} />
          </Field>
          <Field label="Description" error={errs.description}>
            <textarea className="admin-input" rows={4} value={form.description} onChange={e => setField('description', e.target.value)} />
          </Field>
          <Field label="Categories" error={errs.categories} hint="Comma-separated slugs, e.g. salt-lamps,accessories">
            <input className="admin-input" value={form.categories} onChange={e => setField('categories', e.target.value)} />
          </Field>
          <Field label="Tags" error={errs.tags} hint="Comma-separated slugs (optional)">
            <input className="admin-input" value={form.tags} onChange={e => setField('tags', e.target.value)} />
          </Field>
          <label className="admin-checkbox">
            <input type="checkbox" checked={form.visible} onChange={e => setField('visible', e.target.checked)} />
            <span>Visible in the shop</span>
          </label>
        </section>

        <section className="admin-card">
          <h2><Icon name="image" tone="amber" className="admin-card-icon" />Image</h2>
          <div className="admin-image-editor">
            {currentImage ? <img className="admin-image-preview" src={currentImage} alt="" /> : <div className="admin-image-preview admin-image-preview--empty">No image</div>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickImage} hidden />
            <button className="admin-btn admin-btn--ghost" type="button" onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={15} />{currentImage ? 'Choose replacement' : 'Choose image'}
            </button>
            {errs.image && <span className="admin-field-error">{errs.image}</span>}
            {imageFile && <p className="admin-muted">{isNew ? 'Uploads after you save.' : uploading ? 'Uploading…' : 'Uploads when you save.'}</p>}
          </div>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <h2><Icon name="tag" tone="amber" className="admin-card-icon" />Variants / SKUs</h2>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setSkus(list => [...list, blankSku()])}><Icon name="plus" size={15} />Add SKU</button>
        </div>
        <div className="admin-sku-list">
          {skus.map((s, i) => (
            <div key={s.id || `new-${i}`} className={`admin-sku-row ${errs[`sku_${i}`] ? 'admin-sku-row--error' : ''}`}>
              <Field label="SKU code">
                <input className="admin-input" value={s.sku} onChange={e => setSku(i, 'sku', e.target.value)} />
              </Field>
              <Field label="Variant">
                <input className="admin-input" value={s.variant_label} onChange={e => setSku(i, 'variant_label', e.target.value)} placeholder="(none)" />
              </Field>
              <Field label="Price (£)">
                <input className="admin-input" inputMode="decimal" value={s.price} onChange={e => setSku(i, 'price', e.target.value)} />
              </Field>
              <Field label="Stock mode">
                <select className="admin-input" value={s.track_mode} onChange={e => setSku(i, 'track_mode', e.target.value)}>
                  <option value="quantity">Quantity</option>
                  <option value="binary">In / out</option>
                </select>
              </Field>
              {s.track_mode === 'quantity' ? (
                <Field label="Quantity">
                  <input className="admin-input" inputMode="numeric" value={s.quantity} onChange={e => setSku(i, 'quantity', e.target.value)} />
                </Field>
              ) : (
                <label className="admin-checkbox admin-checkbox--inline">
                  <input type="checkbox" checked={s.in_stock} onChange={e => setSku(i, 'in_stock', e.target.checked)} />
                  <span>In stock</span>
                </label>
              )}
              <button
                className="admin-link admin-link--danger admin-sku-remove"
                type="button"
                onClick={() => setSkus(list => list.filter((_, j) => j !== i))}
                disabled={skus.length === 1}
                title={skus.length === 1 ? 'A product needs at least one SKU' : 'Remove'}
              >
                Remove
              </button>
              {errs[`sku_${i}`] && <span className="admin-field-error admin-sku-error">{errs[`sku_${i}`]}</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="admin-sticky-actions">
        <button className="admin-btn admin-btn--primary" disabled={saving || uploading} onClick={save}>
          <Icon name="check" size={15} />{saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
        </button>
      </div>
    </>
  )
}

// ---- inventory ------------------------------------------------------------

function StockBadge({ status }) {
  if (!status) return null
  return (
    <span className={`admin-badge admin-badge--stock-${status}`}>
      {status === 'out' ? 'Out of stock' : 'Low stock'}
    </span>
  )
}

function Inventory() {
  const { loading, error, data, reload } = usePageData(() => api('/api/admin/products'))
  const [edits, setEdits] = useState({}) // skuId -> { quantity? , in_stock? }
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')
  const [q, setQ] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [page, setPage] = useState(0)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const rows = data.products.flatMap(p => p.skus.map(s => ({ ...s, productName: p.name })))
  // Matches the low/out-of-stock definitions used on the dashboard (functions/api/admin/stats.js).
  const stockStatus = s => {
    if (s.track_mode === 'quantity') {
      if (s.quantity <= 0) return 'out'
      if (s.quantity <= LOW_STOCK_THRESHOLD) return 'low'
    } else if (!s.in_stock) {
      return 'out'
    }
    return null
  }

  const setQty = (id, v) => setEdits(e => ({ ...e, [id]: { quantity: v } }))
  const setInStock = (id, v) => setEdits(e => ({ ...e, [id]: { in_stock: v } }))

  const save = async () => {
    const lines = Object.entries(edits).map(([skuId, v]) => ({ skuId: Number(skuId), ...v }))
    if (lines.length === 0) return
    setSaving(true)
    setSaveErr(null)
    setSavedMsg('')
    try {
      await api('/api/admin/inventory', { method: 'PATCH', body: { lines } })
      setEdits({})
      setSavedMsg('Stock updated.')
      await reload()
    } catch (e) {
      setSaveErr(e)
    } finally {
      setSaving(false)
    }
  }

  const needle = q.trim().toLowerCase()
  const filtered = rows.filter(s => {
    const status = stockStatus(s)
    if (stockFilter === 'low' && status !== 'low') return false
    if (stockFilter === 'out' && status !== 'out') return false
    if (needle && !s.productName.toLowerCase().includes(needle) && !s.sku.toLowerCase().includes(needle)) return false
    return true
  })
  const { page: shownPage, pageCount, pageItems } = paginate(filtered, page)

  return (
    <>
      <div className="admin-card-head admin-card-head--bare">
        <p className="admin-muted">Low-stock threshold: {LOW_STOCK_THRESHOLD}</p>
        <button className="admin-btn admin-btn--primary" disabled={saving || Object.keys(edits).length === 0} onClick={save}>
          <Icon name="check" size={15} />{saving ? 'Saving…' : `Save changes${Object.keys(edits).length ? ` (${Object.keys(edits).length})` : ''}`}
        </button>
      </div>
      <div className="admin-filters">
        <SearchInput
          placeholder="Search product or SKU…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(0) }}
        />
        <select className="admin-input" value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(0) }}>
          <option value="">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>
      {savedMsg && <div className="admin-state admin-state--ok">{savedMsg}</div>}
      {saveErr && <ErrorState error={saveErr} />}
      <section className="admin-card">
        {pageItems.length === 0 ? (
          <EmptyState>No SKUs match.</EmptyState>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Variant</th><th>Mode</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              {pageItems.map(s => {
                const edit = edits[s.id] || {}
                const status = stockStatus(s)
                return (
                  <tr key={s.id} className={status ? 'admin-row--warn' : ''}>
                    <td>{s.productName}</td>
                    <td>{s.sku}</td>
                    <td>{s.variant_label || '—'}</td>
                    <td>{s.track_mode}</td>
                    <td>
                      {s.track_mode === 'quantity' ? (
                        <input
                          className="admin-input admin-input--sm"
                          inputMode="numeric"
                          value={edit.quantity != null ? edit.quantity : s.quantity}
                          onChange={e => setQty(s.id, e.target.value)}
                        />
                      ) : (
                        <label className="admin-checkbox admin-checkbox--inline">
                          <input
                            type="checkbox"
                            checked={edit.in_stock != null ? edit.in_stock : !!s.in_stock}
                            onChange={e => setInStock(s.id, e.target.checked)}
                          />
                          <span>In stock</span>
                        </label>
                      )}
                    </td>
                    <td><StockBadge status={status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <Pagination page={shownPage} pageCount={pageCount} onChange={setPage} />
      </section>
    </>
  )
}

// ---- reports --------------------------------------------------------------

function Reports() {
  const { loading, error, data, reload } = usePageData(() =>
    Promise.all([
      api('/api/admin/reports/sales'),
      api('/api/admin/reports/top-products'),
      api('/api/admin/reports/inventory-valuation'),
    ]).then(([sales, products, inventory]) => ({ sales, products, inventory })),
  )
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { sales, products, inventory } = data
  return (
    <>
      <section className="admin-card">
        <div className="admin-card-head">
          <h2><Icon name="trendingUp" tone="amber" className="admin-card-icon" />Sales — last 30 days</h2>
          <a className="admin-link" href="/api/admin/reports/sales?format=csv"><Icon name="download" size={13} className="admin-link-icon" />Export CSV</a>
        </div>
        <p className="admin-total">{gbp(sales.totals.revenue_pence)} across {sales.totals.orders} orders</p>
        <SalesBars series={sales.series} />
      </section>

      <div className="admin-two-col">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2><Icon name="star" tone="amber" className="admin-card-icon" />Best sellers</h2>
            <a className="admin-link" href="/api/admin/reports/top-products?format=csv"><Icon name="download" size={13} className="admin-link-icon" />Export CSV</a>
          </div>
          {products.top_products.length === 0 ? <EmptyState>No sales yet.</EmptyState> : (
            <table className="admin-table">
              <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
              <tbody>{products.top_products.slice(0, 15).map(p => (
                <tr key={p.id}><td>{p.name}</td><td>{p.units}</td><td>{gbp(p.revenue_pence)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>

        <section className="admin-card">
          <h2><Icon name="tag" tone="amber" className="admin-card-icon" />Revenue by category</h2>
          {products.by_category.length === 0 ? <EmptyState>No sales yet.</EmptyState> : (
            <table className="admin-table">
              <thead><tr><th>Category</th><th>Revenue</th></tr></thead>
              <tbody>{products.by_category.map(c => (
                <tr key={c.category}><td>{c.category}</td><td>{gbp(c.revenue_pence)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <h2><Icon name="warehouse" tone="amber" className="admin-card-icon" />Inventory</h2>
          <a className="admin-link" href="/api/admin/reports/inventory-valuation?format=csv"><Icon name="download" size={13} className="admin-link-icon" />Export low-stock CSV</a>
        </div>
        <p className="admin-total">Stock on hand: <strong>{gbp(inventory.valuation.value_pence)}</strong> ({inventory.valuation.units} units)</p>
        {inventory.low_or_out_of_stock.length === 0 ? <EmptyState>Nothing low or out of stock.</EmptyState> : (
          <table className="admin-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Variant</th><th>Mode</th><th>Stock</th></tr></thead>
            <tbody>{inventory.low_or_out_of_stock.map(s => (
              <tr key={s.id} className="admin-row--warn">
                <td>{s.name}</td><td>{s.sku}</td><td>{s.variant_label || '—'}</td><td>{s.track_mode}</td>
                <td>{s.track_mode === 'quantity' ? s.quantity : (s.in_stock ? 'In' : 'Out')}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  )
}

// ---- settings -------------------------------------------------------------

function Settings() {
  return (
    <section className="admin-card">
      <h2><Icon name="sliders" tone="amber" className="admin-card-icon" />Settings</h2>
      <p className="admin-kv"><span>Low-stock threshold</span><strong>{LOW_STOCK_THRESHOLD} units</strong></p>
      <p className="admin-kv"><span>Currency</span><strong>GBP (£)</strong></p>
      <p className="admin-muted">
        Store details, shipping, and payout settings are managed in Stripe and Cloudflare.
        Product, stock, and order operations live in the sections on the left.
      </p>
    </section>
  )
}

// ---- shell ----------------------------------------------------------------

const NAV = [
  { key: '', label: 'Dashboard', href: '/admin', icon: 'home' },
  { key: 'orders', label: 'Orders', href: '/admin/orders', icon: 'receipt' },
  { key: 'products', label: 'Products', href: '/admin/products', icon: 'box' },
  { key: 'inventory', label: 'Inventory', href: '/admin/inventory', icon: 'warehouse' },
  { key: 'reports', label: 'Reports', href: '/admin/reports', icon: 'barChart' },
  { key: 'settings', label: 'Settings', href: '/admin/settings', icon: 'sliders' },
  {
    key: 'docs',
    label: 'Documentation',
    icon: 'book',
    children: [
      { key: 'docs/infrastructure', label: 'Infrastructure', href: '/admin/docs/infrastructure', icon: 'server' },
      { key: 'docs/technical', label: 'Technical Doc', href: '/admin/docs/technical', icon: 'fileText' },
      { key: 'docs/pricing', label: 'Pricing', href: '/admin/docs/pricing', icon: 'tag' },
      { key: 'docs/migration', label: 'Migration', href: '/admin/docs/migration', icon: 'transfer' },
    ],
  },
]

const TITLES = {
  '': 'Dashboard',
  orders: 'Orders',
  products: 'Products',
  inventory: 'Inventory',
  reports: 'Reports',
  settings: 'Settings',
  docs: 'Documentation',
  'docs/infrastructure': 'Infrastructure',
  'docs/technical': 'Technical Documentation',
  'docs/pricing': 'Pricing',
  'docs/migration': 'Migration',
}

export default function AdminApp({ route }) {
  const [navOpen, setNavOpen] = useState(false)

  const { section, params } = useMemo(() => {
    const rest = route.replace(/^\/admin\/?/, '').replace(/\/+$/, '')
    const [sec, ...rst] = rest.split('/').filter(Boolean)
    return { section: sec || '', params: rst }
  }, [route])

  // For nested sections (docs), the active nav item and page title are keyed on
  // "section/param" (e.g. "docs/infrastructure"); top-level pages key on section alone.
  const activeKey = section === 'docs' && params[0] ? `docs/${params[0]}` : section
  const [docsOpen, setDocsOpen] = useState(section === 'docs')
  useEffect(() => { if (section === 'docs') setDocsOpen(true) }, [section])

  useEffect(() => {
    document.title = `${TITLES[activeKey] || 'Admin'} · Salty Lamps Admin`
  }, [activeKey])

  let page
  if (section === '') page = <Dashboard />
  else if (section === 'orders') page = params[0] ? <OrderDetail id={params[0]} /> : <OrdersList />
  else if (section === 'products') page = params[0] ? <ProductEdit id={params[0]} /> : <ProductsList />
  else if (section === 'inventory') page = <Inventory />
  else if (section === 'reports') page = <Reports />
  else if (section === 'settings') page = <Settings />
  else if (section === 'docs' && params[0] === 'infrastructure') page = <InfrastructureDoc />
  else if (section === 'docs' && params[0] === 'technical') page = <TechnicalDoc />
  else if (section === 'docs' && params[0] === 'pricing') page = <PricingDoc />
  else if (section === 'docs' && params[0] === 'migration') page = <MigrationDoc />
  else if (section === 'docs') page = <InfrastructureDoc />
  else page = <EmptyState>That admin page doesn’t exist. <AdminLink href="/admin" className="admin-link">Back to dashboard</AdminLink></EmptyState>

  return (
    <div className={`admin-shell ${navOpen ? 'admin-shell--nav-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/media/logo.png" alt="" />
          <span>Salty Lamps</span>
        </div>
        <nav className="admin-nav">
          {NAV.map(item =>
            item.children ? (
              <div key={item.key} className="admin-nav-group">
                <button
                  type="button"
                  className={`admin-nav-link admin-nav-parent ${docsOpen ? 'admin-nav-parent--open' : ''}`}
                  aria-expanded={docsOpen}
                  onClick={() => setDocsOpen(o => !o)}
                >
                  <Icon name={item.icon} size={17} solid={section === item.key} className="admin-nav-icon" />
                  {item.label}
                  <Icon name="chevronDown" size={15} className="admin-nav-caret" />
                </button>
                {docsOpen && (
                  <div className="admin-nav-children">
                    {item.children.map(child => (
                      <AdminLink
                        key={child.href}
                        href={child.href}
                        className={`admin-nav-link admin-nav-child ${activeKey === child.key ? 'admin-nav-link--active' : ''}`}
                        onClick={() => setNavOpen(false)}
                      >
                        <Icon name={child.icon} size={15} solid={activeKey === child.key} className="admin-nav-icon" />
                        {child.label}
                      </AdminLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <AdminLink
                key={item.href}
                href={item.href}
                className={`admin-nav-link ${section === item.key ? 'admin-nav-link--active' : ''}`}
                onClick={() => setNavOpen(false)}
              >
                <Icon name={item.icon} size={17} solid={section === item.key} className="admin-nav-icon" />
                {item.label}
              </AdminLink>
            )
          )}
        </nav>
        <a className="admin-nav-link admin-nav-link--foot" href="/" onClick={e => { e.preventDefault(); navigate('/') }}>
          <Icon name="externalLink" size={15} className="admin-nav-icon" />View store
        </a>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-burger" aria-label="Toggle menu" onClick={() => setNavOpen(o => !o)}>☰</button>
          <h1 className="admin-topbar-title">{TITLES[activeKey] || 'Admin'}</h1>
        </header>
        <main className="admin-content">{page}</main>
      </div>
    </div>
  )
}
