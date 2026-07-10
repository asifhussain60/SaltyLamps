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

// ---- small utilities ------------------------------------------------------

const gbp = pence =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format((Number(pence) || 0) / 100)

const dateFmt = s => {
  if (!s) return '—'
  const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z'))
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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
      <p>{error?.message || 'Something went wrong.'}</p>
      {onRetry && <button className="admin-btn" onClick={onRetry}>Try again</button>}
    </div>
  )
}

function EmptyState({ children }) {
  return <div className="admin-state admin-state--empty">{children}</div>
}

function StatusBadge({ value, kind = 'payment' }) {
  return <span className={`admin-badge admin-badge--${kind}-${value}`}>{value}</span>
}

function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className={`admin-btn ${danger ? 'admin-btn--danger' : 'admin-btn--primary'}`} onClick={onConfirm}>
            {confirmLabel}
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

function StatTile({ label, value, tone }) {
  return (
    <div className={`admin-tile admin-tile--${tone || 'neutral'}`}>
      <span className="admin-tile-value">{value}</span>
      <span className="admin-tile-label">{label}</span>
    </div>
  )
}

function SalesBars({ series }) {
  if (!series?.length) return <EmptyState>No sales in this window yet.</EmptyState>
  const max = Math.max(...series.map(d => d.revenue_pence), 1)
  const W = 640
  const H = 160
  const gap = 6
  const bw = (W - gap * (series.length - 1)) / series.length
  return (
    <svg className="admin-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily sales">
      {series.map((d, i) => {
        const h = Math.max(2, (d.revenue_pence / max) * (H - 24))
        return (
          <g key={d.day}>
            <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx="3" className="admin-chart-bar">
              <title>{`${d.day}: ${gbp(d.revenue_pence)} (${d.orders} orders)`}</title>
            </rect>
          </g>
        )
      })}
    </svg>
  )
}

function Dashboard() {
  const { loading, error, data, reload } = usePageData(() => api('/api/admin/stats'))
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <>
      <div className="admin-tiles">
        <StatTile label="Revenue today" value={gbp(data.revenue.today_pence)} tone="amber" />
        <StatTile label="Revenue this week" value={gbp(data.revenue.week_pence)} tone="amber" />
        <StatTile label="Revenue this month" value={gbp(data.revenue.month_pence)} tone="amber" />
        <StatTile label="Avg order" value={gbp(data.average_order_pence)} tone="neutral" />
        <StatTile label="Orders to fulfil" value={data.orders.unfulfilled} tone={data.orders.unfulfilled ? 'blue' : 'neutral'} />
        <StatTile label="Low stock" value={data.stock.low_stock} tone={data.stock.low_stock ? 'rose' : 'neutral'} />
        <StatTile label="Out of stock" value={data.stock.out_of_stock} tone={data.stock.out_of_stock ? 'rose' : 'neutral'} />
        <StatTile label="Orders all-time" value={data.orders.all_time} tone="neutral" />
      </div>

      <section className="admin-card">
        <h2>Sales — last 14 days</h2>
        <SalesBars series={data.sales_series} />
      </section>

      <div className="admin-two-col">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Recent orders</h2>
            <AdminLink href="/admin/orders" className="admin-link">View all</AdminLink>
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
                    <td><StatusBadge value={o.fulfilment_status} kind="fulfilment" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-card">
          <h2>Top products</h2>
          {data.top_products.length === 0 ? (
            <EmptyState>No sales yet.</EmptyState>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.top_products.map(p => (
                  <tr key={p.name}><td>{p.name}</td><td>{p.qty}</td><td>{gbp(p.revenue_pence)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  )
}

// ---- orders ---------------------------------------------------------------

function OrdersList() {
  const [status, setStatus] = useState('')
  const [fulfilment, setFulfilment] = useState('')
  const [q, setQ] = useState('')
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (fulfilment) qs.set('fulfilment', fulfilment)
  if (q) qs.set('q', q)
  const { loading, error, data, reload } = usePageData(
    () => api(`/api/admin/orders?${qs.toString()}`),
    [status, fulfilment, q],
  )

  return (
    <>
      <div className="admin-filters">
        <input className="admin-input" placeholder="Search email or order id…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="admin-input" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All payments</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="admin-input" value={fulfilment} onChange={e => setFulfilment(e.target.value)}>
          <option value="">All fulfilment</option>
          {FULFILMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
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
          <h2>Items</h2>
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
          <h2>Customer & shipping</h2>
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
          <h2>Fulfilment</h2>
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
            {saving ? 'Saving…' : 'Save fulfilment'}
          </button>
        </div>
        <div className="admin-danger-row">
          {order.status === 'paid' && (
            <>
              <button className="admin-btn admin-btn--danger" disabled={saving} onClick={() => setConfirm('refunded')}>Refund order</button>
              <button className="admin-btn admin-btn--ghost" disabled={saving} onClick={() => setConfirm('cancelled')}>Mark cancelled</button>
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

  return (
    <>
      <div className="admin-card-head admin-card-head--bare">
        <p className="admin-muted">{data.products.length} products</p>
        <AdminLink href="/admin/products/new" className="admin-btn admin-btn--primary">+ New product</AdminLink>
      </div>
      {actionErr && <ErrorState error={actionErr} />}
      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th></th><th>Name</th><th>SKUs</th><th>Price</th><th>Visible</th><th></th></tr>
          </thead>
          <tbody>
            {data.products.map(p => {
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
          <h2>Details</h2>
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
          <h2>Image</h2>
          <div className="admin-image-editor">
            {currentImage ? <img className="admin-image-preview" src={currentImage} alt="" /> : <div className="admin-image-preview admin-image-preview--empty">No image</div>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickImage} hidden />
            <button className="admin-btn admin-btn--ghost" type="button" onClick={() => fileRef.current?.click()}>
              {currentImage ? 'Choose replacement' : 'Choose image'}
            </button>
            {errs.image && <span className="admin-field-error">{errs.image}</span>}
            {imageFile && <p className="admin-muted">{isNew ? 'Uploads after you save.' : uploading ? 'Uploading…' : 'Uploads when you save.'}</p>}
          </div>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <h2>Variants / SKUs</h2>
          <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setSkus(list => [...list, blankSku()])}>+ Add SKU</button>
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
          {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
        </button>
      </div>
    </>
  )
}

// ---- inventory ------------------------------------------------------------

function Inventory() {
  const { loading, error, data, reload } = usePageData(() => api('/api/admin/products'))
  const [edits, setEdits] = useState({}) // skuId -> { quantity? , in_stock? }
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const rows = data.products.flatMap(p => p.skus.map(s => ({ ...s, productName: p.name })))
  const lowOrOut = s =>
    (s.track_mode === 'quantity' && s.quantity <= LOW_STOCK_THRESHOLD) || (s.track_mode === 'binary' && !s.in_stock)

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

  return (
    <>
      <div className="admin-card-head admin-card-head--bare">
        <p className="admin-muted">Low-stock threshold: {LOW_STOCK_THRESHOLD}</p>
        <button className="admin-btn admin-btn--primary" disabled={saving || Object.keys(edits).length === 0} onClick={save}>
          {saving ? 'Saving…' : `Save changes${Object.keys(edits).length ? ` (${Object.keys(edits).length})` : ''}`}
        </button>
      </div>
      {savedMsg && <div className="admin-state admin-state--ok">{savedMsg}</div>}
      {saveErr && <ErrorState error={saveErr} />}
      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Variant</th><th>Mode</th><th>Stock</th></tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const edit = edits[s.id] || {}
              return (
                <tr key={s.id} className={lowOrOut(s) ? 'admin-row--warn' : ''}>
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
                </tr>
              )
            })}
          </tbody>
        </table>
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
          <h2>Sales — last 30 days</h2>
          <a className="admin-link" href="/api/admin/reports/sales?format=csv">Export CSV</a>
        </div>
        <p className="admin-total">{gbp(sales.totals.revenue_pence)} across {sales.totals.orders} orders</p>
        <SalesBars series={sales.series} />
      </section>

      <div className="admin-two-col">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Best sellers</h2>
            <a className="admin-link" href="/api/admin/reports/top-products?format=csv">Export CSV</a>
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
          <h2>Revenue by category</h2>
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
          <h2>Inventory</h2>
          <a className="admin-link" href="/api/admin/reports/inventory-valuation?format=csv">Export low-stock CSV</a>
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
      <h2>Settings</h2>
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
  { key: '', label: 'Dashboard', href: '/admin' },
  { key: 'orders', label: 'Orders', href: '/admin/orders' },
  { key: 'products', label: 'Products', href: '/admin/products' },
  { key: 'inventory', label: 'Inventory', href: '/admin/inventory' },
  { key: 'reports', label: 'Reports', href: '/admin/reports' },
  { key: 'settings', label: 'Settings', href: '/admin/settings' },
]

const TITLES = {
  '': 'Dashboard',
  orders: 'Orders',
  products: 'Products',
  inventory: 'Inventory',
  reports: 'Reports',
  settings: 'Settings',
}

export default function AdminApp({ route }) {
  const [navOpen, setNavOpen] = useState(false)

  const { section, params } = useMemo(() => {
    const rest = route.replace(/^\/admin\/?/, '').replace(/\/+$/, '')
    const [sec, ...rst] = rest.split('/').filter(Boolean)
    return { section: sec || '', params: rst }
  }, [route])

  useEffect(() => {
    document.title = `${TITLES[section] || 'Admin'} · Salty Lamps Admin`
  }, [section])

  let page
  if (section === '') page = <Dashboard />
  else if (section === 'orders') page = params[0] ? <OrderDetail id={params[0]} /> : <OrdersList />
  else if (section === 'products') page = params[0] ? <ProductEdit id={params[0]} /> : <ProductsList />
  else if (section === 'inventory') page = <Inventory />
  else if (section === 'reports') page = <Reports />
  else if (section === 'settings') page = <Settings />
  else page = <EmptyState>That admin page doesn’t exist. <AdminLink href="/admin" className="admin-link">Back to dashboard</AdminLink></EmptyState>

  return (
    <div className={`admin-shell ${navOpen ? 'admin-shell--nav-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/media/logo.png" alt="" />
          <span>Salty Lamps</span>
        </div>
        <nav className="admin-nav">
          {NAV.map(item => (
            <AdminLink
              key={item.href}
              href={item.href}
              className={`admin-nav-link ${section === item.key ? 'admin-nav-link--active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </AdminLink>
          ))}
        </nav>
        <a className="admin-nav-link admin-nav-link--foot" href="/" onClick={e => { e.preventDefault(); navigate('/') }}>← View store</a>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-burger" aria-label="Toggle menu" onClick={() => setNavOpen(o => !o)}>☰</button>
          <h1 className="admin-topbar-title">{TITLES[section] || 'Admin'}</h1>
        </header>
        <main className="admin-content">{page}</main>
      </div>
    </div>
  )
}
