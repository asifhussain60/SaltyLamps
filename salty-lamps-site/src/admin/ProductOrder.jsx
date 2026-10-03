import React, { useEffect, useRef, useState } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { arrayMove, move } from '@dnd-kit/helpers'
import { allowLeave } from './navigation.mjs'

function ProductRow({ product, index, count, busy, onMove }) {
  const { ref, handleRef, isDragSource } = useSortable({ id: product.id, index, disabled: busy })
  return (
    <li ref={ref} className={`admin-order-row ${isDragSource ? 'admin-order-row--moving' : ''}`}>
      <button ref={handleRef} type="button" className="admin-order-handle" aria-label={`Drag ${product.name}`} disabled={busy || count < 2} title="Drag to reorder. With a keyboard, press Space, then arrow keys, then Space again.">⠿</button>
      <span className="admin-order-position" aria-label={`Position ${index + 1}`}>{index + 1}</span>
      {product.image ? <img className="admin-thumb" src={product.image} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb--empty" />}
      <div className="admin-order-name"><strong>{product.name}</strong>
        <small>{!product.visible ? 'Hidden · not shown to customers' : product.option_count ? `${product.option_count} ${product.option_count === 1 ? 'option' : 'options'}` : 'No options · not shown to customers'}</small>
      </div>
      <div className="admin-order-arrows">
        <button type="button" aria-label={`Move ${product.name} up`} disabled={busy || index === 0} onClick={() => onMove(index, index - 1)}>↑</button>
        <button type="button" aria-label={`Move ${product.name} down`} disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)}>↓</button>
      </div>
    </li>
  )
}

export default function ProductOrder({ api, useDirty, onSaved }) {
  const [snapshot, setSnapshot] = useState(null)
  const [draft, setDraft] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const requestId = useRef(null)
  const loadGeneration = useRef(0)
  const dirty = snapshot !== null && draft.some((p, index) => p.id !== snapshot.products[index]?.id)
  useDirty(dirty || saving)

  async function load() {
    const generation = ++loadGeneration.current
    setLoading(true)
    setError(null)
    try {
      const result = await api('/api/admin/products/order')
      if (generation !== loadGeneration.current) return
      setSnapshot(result)
      setDraft(result.products)
      requestId.current = null
      setMessage('')
    } catch (e) {
      if (generation === loadGeneration.current) setError(e)
    } finally {
      if (generation === loadGeneration.current) setLoading(false)
    }
  }
  useEffect(() => { load(); return () => { loadGeneration.current++ } }, [])

  function change(next, announcement) {
    setDraft(next)
    requestId.current = null
    setMessage(announcement)
    // A stale-version error needs a reload; do not silently clear it on a move.
    setError(previous => previous?.status === 409 ? previous : null)
  }
  function moveProduct(from, to) {
    change(arrayMove(draft, from, to), `${draft[from].name} moved to position ${to + 1}.`)
  }
  async function save() {
    if (saving || !dirty || error?.status === 409) return
    setSaving(true)
    setError(null)
    requestId.current ||= crypto.randomUUID()
    try {
      const result = await api('/api/admin/products/order', {
        method: 'PUT', body: { productIds: draft.map(p => p.id), revision: snapshot.revision, requestId: requestId.current },
      })
      setSnapshot({ products: draft, revision: result.revision })
      requestId.current = null
      setMessage('Shop order saved. Customers will see it on their next shop visit or refresh.')
      onSaved()
    } catch (e) {
      setError(e)
    } finally { setSaving(false) }
  }

  if (loading && !snapshot) return <p role="status">Loading shop order…</p>
  if (!snapshot) return <div className="admin-card"><p role="alert">{error?.message || 'Could not load shop order.'}</p><button className="admin-btn" onClick={load}>Try again</button></div>
  const busy = saving || loading
  const preview = draft.filter(p => p.visible && p.option_count > 0)

  return (
    <div className="admin-order" aria-busy={busy}>
      <div><h2 className="admin-order-title">Arrange your shop</h2><p className="admin-muted">Drag products into your preferred order, then save when you’re ready.</p></div>
      {error && <div className="admin-order-error" role="alert"><p>{error.message}</p>
        {error.status === 409 && <button className="admin-btn" disabled={busy} onClick={() => { if (allowLeave()) load() }}>Reload saved order</button>}
      </div>}
      <div className="admin-order-layout">
        <section className="admin-card" aria-labelledby="product-order-heading">
          <div className="admin-card-head"><h3 id="product-order-heading">Product order</h3><span className="admin-order-badge">{dirty ? 'Unsaved changes' : `${draft.length} products`}</span></div>
          <p className="admin-order-hint">One order across the shop. Categories keep this relative order.<br />Use the handles to drag, or the arrows to move a product.</p>
          <DragDropProvider
            onDragStart={() => setDragging(true)}
            onDragEnd={event => {
              setDragging(false)
              if (event.canceled) { setMessage('Move cancelled.'); return }
              const next = move(draft, event)
              const source = event.operation.source
              const index = next.findIndex(p => p.id === source?.id)
              if (index >= 0) change(next, `${next[index].name} moved to position ${index + 1}.`)
            }}
          >
            <ol className="admin-order-list" aria-label="Product order">
              {draft.map((product, index) => <ProductRow key={product.id} product={product} index={index} count={draft.length} busy={busy} onMove={moveProduct} />)}
            </ol>
          </DragDropProvider>
          {!draft.length && <p className="admin-muted">Add products before arranging your shop.</p>}
          <p className="admin-order-note">Hidden products stay hidden. Newly added products follow the saved list. Out-of-stock products keep their chosen position.</p>
        </section>
        <section className="admin-card admin-order-preview" aria-labelledby="order-preview-heading">
          <h3 id="order-preview-heading">Customer preview</h3>
          <p className="admin-order-hint">First {Math.min(preview.length, 6)} of {preview.length} visible products · Featured order</p>
          <div className="admin-order-preview-grid">{preview.slice(0, 6).map(product => <div className="admin-order-preview-card" key={product.id}>
            {product.image ? <img src={product.image} alt="" loading="lazy" /> : <div className="admin-order-image-empty">No photo</div>}
            <strong>{product.name}</strong>
          </div>)}</div>
          {!preview.length && <p className="admin-muted">No visible products to preview.</p>}
          <p className="admin-order-hint">Draft layout of All products. Customers can still sort by price or name. Collection headings keep their existing order.</p>
        </section>
      </div>
      <div className="admin-order-savebar">
        <div role="status" aria-live="polite">{message || (dirty ? 'Your changes are ready to review.' : 'The shop updates only after you save.')}</div>
        <div className="admin-order-save-actions">
          <button className="admin-btn" disabled={!dirty || busy || dragging} onClick={() => change(snapshot.products, 'Draft discarded. Saved order restored.')}>Discard changes</button>
          <button className="admin-btn admin-btn--primary" disabled={!dirty || busy || dragging || error?.status === 409} onClick={save}>{saving ? 'Saving…' : 'Save shop order'}</button>
        </div>
      </div>
    </div>
  )
}
