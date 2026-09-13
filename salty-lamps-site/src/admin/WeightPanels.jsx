import React, { useState, useEffect } from 'react'
import {
  parseWeight,
  weightInput,
  validateWeights,
  validatePostageConfig,
  quotePostage,
} from '../../functions/lib/weights.mjs'

export function weightForm(s = {}) {
  return {
    product_weight_min: weightInput(s.product_weight_min_g),
    product_weight_max: weightInput(s.product_weight_max_g),
    packed_weight: weightInput(s.packed_weight_g),
    postal_group: s.postal_group || '',
    weight_public: s.weight_public == null ? true : !!s.weight_public,
  }
}
export function weightPayload(s) {
  return validateWeights({
    product_weight_min_g: parseWeight(s.product_weight_min),
    product_weight_max_g: parseWeight(s.product_weight_max),
    packed_weight_g: parseWeight(s.packed_weight),
    postal_group: s.postal_group || '',
    weight_public: !!s.weight_public,
  })
}
export function WeightFields({ value, onChange, groups = [] }) {
  return (
    <fieldset className="admin-weight-fields">
      <legend>Weight & delivery</legend>
      <p className="admin-muted">
        Enter weights for one complete sellable item or pack. Product weight
        excludes packaging; shipping weight includes it.
      </p>
      <div className="admin-weight-grid">
        {[
          ['product_weight_min', 'Product weight from (kg)'],
          ['product_weight_max', 'Product weight to (kg)'],
          ['packed_weight', 'Packed shipping weight (kg)'],
        ].map(([key, label]) => (
          <label className="admin-field" key={key}>
            <span className="admin-field-label">{label}</span>
            <input
              className="admin-input"
              inputMode="decimal"
              value={value[key] ?? ''}
              onChange={(e) => onChange(key, e.target.value)}
            />
          </label>
        ))}
        <label className="admin-field">
          <span className="admin-field-label">Postal group</span>
          <input
            className="admin-input"
            value={value.postal_group || ''}
            onChange={(e) => onChange('postal_group', e.target.value)}
            placeholder={groups[0] || 'e.g. Standard'}
          />
        </label>
        <label className="admin-weight-check">
          <input
            type="checkbox"
            checked={!!value.weight_public}
            onChange={(e) => onChange('weight_public', e.target.checked)}
          />
          Show product weight to customers
        </label>
      </div>
      <small className="admin-weight-hint">
        For a fixed weight, enter the same value in both product fields. Leave
        unknown weights blank.
      </small>
      <a className="admin-link" href="/admin/settings/delivery">
        Manage delivery rates →
      </a>
    </fieldset>
  )
}
function useLoad(api, url) {
  const [state, set] = useState({ loading: true })
  const [rev, reload] = useState(0)
  useEffect(() => {
    let alive = true
    set({ loading: true })
    api(url)
      .then((data) => alive && set({ data, loading: false }))
      .catch((error) => alive && set({ error, loading: false }))
    return () => {
      alive = false
    }
  }, [url, rev, api])
  return { ...state, reload: () => reload((x) => x + 1) }
}
function Message({ error, success }) {
  return error ? (
    <div className="admin-state admin-state--error" role="alert">
      {error.message || error}
    </div>
  ) : success ? (
    <div className="admin-state admin-state--ok" role="status">
      {success}
    </div>
  ) : null
}
const money = (p) =>
  p == null
    ? 'Not recorded'
    : new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(p / 100)
export function DeliverySettings({ api, useDirty }) {
  const { data, error, loading, reload } = useLoad(api, '/api/admin/postage')
  const [form, setForm] = useState(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState({})
  useDirty(dirty)
  useEffect(() => {
    if (data) {
      setForm({
        ...data.config,
        rates: data.config.rates.map((r) => ({
          ...r,
          min: weightInput(r.min_g),
          max: weightInput(r.max_g),
          price: (r.price_pence / 100).toFixed(2),
        })),
      })
      setDirty(false)
    }
  }, [data])
  if (loading) return <p>Loading delivery settings…</p>
  if (error) return <Message error={error} />
  if (!form) return null
  const edit = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
    setMessage({})
  }
  const setRate = (i, key, value) =>
    edit(
      'rates',
      form.rates.map((r, j) => (i === j ? { ...r, [key]: value } : r)),
    )
  const save = async () => {
    setMessage({})
    setBusy(true)
    try {
      const config = validatePostageConfig({
        ...form,
        rates: form.rates.map((r) => {
          if (!/^\d+(\.\d{1,2})?$/.test(r.price))
            throw new Error(
              'Enter postage in pounds with at most two decimal places.',
            )
          return {
            id: r.id,
            group: r.group,
            service: r.service,
            country: r.country.toUpperCase(),
            postcodes: r.postcodes,
            min_g: /^0+(\.0{1,3})?$/.test(r.min) ? 0 : parseWeight(r.min),
            max_g: parseWeight(r.max),
            price_pence: Math.round(Number(r.price) * 100),
          }
        }),
      })
      await api('/api/admin/postage', { method: 'PUT', body: { config } })
      setDirty(false)
      setMessage({ success: 'Delivery settings saved.' })
      reload()
    } catch (error) {
      setMessage({ error })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>Delivery settings</h2>
        <button
          className="admin-btn"
          onClick={() =>
            edit('rates', [
              ...form.rates,
              {
                id: crypto.randomUUID(),
                group: '',
                service: '',
                country: 'GB',
                postcodes: '',
                min: '0',
                max: '',
                price: '',
              },
            ])
          }
        >
          + Add rate
        </button>
      </div>
      <p className="admin-muted">
        Maintain packed weights and postage estimates for despatch. Automatic
        checkout charging is not enabled.
      </p>
      <div className="admin-weight-grid">
        <label className="admin-field">
          <span className="admin-field-label">
            Customer weight display unit
          </span>
          <select
            className="admin-input"
            value={form.unit}
            onChange={(e) => edit('unit', e.target.value)}
          >
            <option value="kg">Kilograms (kg)</option>
            <option value="g">Grams (g)</option>
          </select>
        </label>
        <label className="admin-weight-check">
          <input
            type="checkbox"
            checked={form.show_cards}
            onChange={(e) => edit('show_cards', e.target.checked)}
          />
          Show weight summaries on catalogue cards
        </label>
      </div>
      <p className="admin-muted">
        Admin entry uses kilograms. Changing the customer display unit converts
        values; it does not change recorded weights.
      </p>
      <Message {...message} />
      {!form.rates.length && (
        <div className="admin-state">
          No delivery rates yet. Add your own rates; unknown postage will be
          marked for review.
        </div>
      )}
      {form.rates.map((r, i) => (
        <fieldset key={r.id} className="admin-rate-card">
          <legend>
            Rate {i + 1} · {r.service || 'New service'}
          </legend>
          <div className="admin-weight-grid">
            {[
              ['group', 'Postal group'],
              ['service', 'Service / carrier'],
              ['country', 'Country code (e.g. GB)'],
              ['postcodes', 'Postcode prefixes (optional)'],
              ['min', 'Over (kg) — exclusive'],
              ['max', 'Up to (kg) — inclusive'],
              ['price', 'Postage (£)'],
            ].map(([key, label]) => (
              <label key={key} className="admin-field">
                <span className="admin-field-label">{label}</span>
                <input
                  className="admin-input"
                  value={r[key]}
                  inputMode={
                    ['min', 'max', 'price'].includes(key) ? 'decimal' : 'text'
                  }
                  onChange={(e) => setRate(i, key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="admin-weight-hint">
            Blank postcode prefixes cover the whole country. Otherwise enter
            comma-separated prefixes, for example SW1, W1.
          </p>
          <button
            className="admin-btn admin-btn--ghost"
            onClick={() =>
              edit(
                'rates',
                form.rates.filter((_, j) => i !== j),
              )
            }
          >
            Remove rate
          </button>
        </fieldset>
      ))}
      <div className="admin-form-actions">
        <button
          className="admin-btn admin-btn--primary"
          onClick={save}
          disabled={busy || !dirty}
        >
          {busy ? 'Saving…' : 'Save delivery settings'}
        </button>
      </div>
    </section>
  )
}
export function BulkWeights({ api, useDirty }) {
  const { data, loading, error, reload } = useLoad(api, '/api/admin/products')
  const [edits, setEdits] = useState({}),
    [q, setQ] = useState(''),
    [missing, setMissing] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState({})
  useDirty(Object.keys(edits).length > 0)
  if (loading) return <p>Loading weights…</p>
  if (error) return <Message error={error} />
  const rows = data.products
    .flatMap((p) =>
      p.skus.map((s) => ({ ...s, productName: p.name, productId: p.id })),
    )
    .filter(
      (s) =>
        (!missing || s.packed_weight_g == null || !s.postal_group) &&
        `${s.productName} ${s.sku} ${s.variant_label}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
  const save = async () => {
    setBusy(true)
    setMessage({})
    try {
      const lines = Object.entries(edits).map(([id, value]) => ({
        skuId: Number(id),
        ...weightPayload(value),
      }))
      await api('/api/admin/weights', { method: 'PATCH', body: { lines } })
      setEdits({})
      setMessage({ success: 'Weights saved.' })
      reload()
    } catch (error) {
      setMessage({ error })
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="admin-filters">
        <input
          className="admin-input"
          aria-label="Search weights"
          placeholder="Search product or option…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="admin-weight-check">
          <input
            type="checkbox"
            checked={missing}
            onChange={(e) => setMissing(e.target.checked)}
          />
          Missing packed weight or postal group
        </label>
      </div>
      <Message {...message} />
      <p className="admin-muted">
        {rows.length} options. Updates use the same weights as the product
        editor.
      </p>
      {rows.map((s) => (
        <section className="admin-card" key={s.id}>
          <h2>
            <a className="admin-link" href={`/admin/products/${s.productId}`}>
              {s.productName}
            </a>
            {s.variant_label ? ` · ${s.variant_label}` : ''}
          </h2>
          <WeightFields
            value={edits[s.id] || weightForm(s)}
            onChange={(k, v) =>
              setEdits((e) => ({
                ...e,
                [s.id]: { ...(e[s.id] || weightForm(s)), [k]: v },
              }))
            }
          />
        </section>
      ))}
      <div className="admin-form-actions admin-weight-save">
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy || !Object.keys(edits).length}
          onClick={save}
        >
          {busy ? 'Saving…' : `Save weights (${Object.keys(edits).length})`}
        </button>
      </div>
    </>
  )
}
export function OrderPostage({ api, id, useDirty }) {
  const { data, loading, error, reload } = useLoad(
    api,
    `/api/admin/orders/${id}/postage`,
  )
  const [form, setForm] = useState({}),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState({})
  useDirty(dirty)
  useEffect(() => {
    if (data) {
      setForm({
        weight: weightInput(data.saved?.actual_weight_g),
        cost:
          data.saved?.actual_cost_pence == null
            ? ''
            : String(data.saved.actual_cost_pence / 100),
        service: data.saved?.service || '',
        notes: data.saved?.notes || '',
      })
      setDirty(false)
    }
  }, [data])
  if (loading) return <p>Loading order postage…</p>
  if (error) return <Message error={error} />
  const edit = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDirty(true)
    setMessage({})
  }
  let quote = data.quote
  try {
    quote = quotePostage(
      data.lines,
      data.config,
      { country: data.country, postcode: data.postcode },
      parseWeight(form.weight) ?? null,
    )
  } catch {
    quote = {
      status: 'needs_review',
      reason: 'Enter a valid actual parcel weight.',
      options: [],
    }
  }
  let original
  try {
    original = data.saved ? JSON.parse(data.saved.estimate_json) : null
  } catch {}
  const save = async () => {
    setBusy(true)
    setMessage({})
    try {
      if (form.cost !== '' && !/^\d+(\.\d{1,2})?$/.test(form.cost))
        throw new Error('Enter a postage cost with at most two decimal places.')
      await api(`/api/admin/orders/${id}/postage`, {
        method: 'PUT',
        body: {
          actual_weight_g: parseWeight(form.weight) ?? null,
          actual_cost_pence:
            form.cost === '' ? null : Math.round(Number(form.cost) * 100),
          service: form.service,
          notes: form.notes,
        },
      })
      setDirty(false)
      setMessage({ success: 'Postage details saved.' })
      reload()
    } catch (error) {
      setMessage({ error })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="admin-card">
      <h2>Weight & postage</h2>
      <p className="admin-muted">{data.basis}</p>
      <div className="admin-weight-grid">
        <div>
          <span className="admin-field-label">Calculated packed weight</span>
          <p>
            {data.calculated_weight_g == null
              ? 'Needs review'
              : `${weightInput(data.calculated_weight_g)} kg`}
          </p>
        </div>
        <div>
          <span className="admin-field-label">Current estimate</span>
          {quote.options.length ? (
            quote.options.map((r) => (
              <p key={r.id}>
                {r.service} · {money(r.price_pence)}
              </p>
            ))
          ) : (
            <p className="admin-weight-review">Needs review: {quote.reason}</p>
          )}
        </div>
        <div>
          <span className="admin-field-label">Original saved estimate</span>
          <p>
            {original?.options?.length
              ? original.options
                  .map((r) => `${r.service}: ${money(r.price_pence)}`)
                  .join(' / ')
              : original
                ? 'Needs review at time of recording'
                : 'Not recorded yet'}
          </p>
        </div>
      </div>
      <div className="admin-weight-grid">
        {[
          ['weight', 'Actual parcel weight (kg)'],
          ['cost', 'Actual postage paid (£)'],
          ['service', 'Service used'],
        ].map(([key, label]) => (
          <label key={key} className="admin-field">
            <span className="admin-field-label">{label}</span>
            <input
              className="admin-input"
              inputMode={key === 'service' ? 'text' : 'decimal'}
              value={form[key] || ''}
              onChange={(e) => edit(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <label className="admin-field">
        <span className="admin-field-label">Notes / manual adjustments</span>
        <textarea
          className="admin-input"
          value={form.notes || ''}
          onChange={(e) => edit('notes', e.target.value)}
        />
      </label>
      <p className="admin-weight-hint">
        Internal tracking only. Saving postage does not charge the customer or
        mark the order as despatched.
      </p>
      <Message {...message} />
      <div className="admin-form-actions">
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy || !dirty}
          onClick={save}
        >
          {busy ? 'Saving…' : 'Save postage details'}
        </button>
      </div>
    </section>
  )
}

export function PostageReport({ api }) {
  const { data, loading, error } = useLoad(api, '/api/admin/reports/postage')
  if (loading) return <p>Loading postage report…</p>
  if (error) return <Message error={error} />
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>Postage costs & weights</h2>
        <a className="admin-link" href="/api/admin/reports/postage?format=csv">
          Export order postage
        </a>
      </div>
      <p>
        Recorded postage on paid orders:{' '}
        <strong>{money(data.summary.cost_pence)}</strong> ·{' '}
        {data.summary.recorded_costs} of {data.summary.orders} costs recorded.
      </p>
      <p className="admin-muted">
        Missing costs are excluded, not treated as free postage. Cancelled and
        refunded orders remain in the export, with their status.
      </p>
      <a className="admin-link" href="/api/admin/reports/postage?kind=weights">
        Export all product weights
      </a>
    </section>
  )
}
