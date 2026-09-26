import React, { useLayoutEffect, useRef, useState } from 'react'

export function ProductImage({ src, alt, ...props }) {
  const [failed, setFailed] = useState(null)
  if (!src || failed === src) return <div className="product-image-unavailable" role="img" aria-label={alt}>Photo unavailable</div>
  return <img {...props} src={src} alt={alt} onError={() => setFailed(src)} />
}

// The parent keys this gallery by the option identity: changing an option starts
// at its cover, even when two options have equal prices or share a product name.
export default function ProductGallery({ product, category }) {
  const photos = [...new Set([product.image, ...(product.images || [])].filter(Boolean))]
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const enlargeRef = useRef(null)
  const closeRef = useRef(null)
  const navigationRef = useRef(null)
  const active = photos.includes(selected) ? selected : (product.image || photos[0])
  const activeIndex = Math.max(0, photos.indexOf(active))

  const showPhoto = offset => {
    const next = (activeIndex + offset + photos.length) % photos.length
    setSelected(photos[next])
  }

  navigationRef.current = { showPhoto, count: photos.length }

  useLayoutEffect(() => {
    if (!expanded) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = event => {
      if (event.key === 'Escape') setExpanded(false)
      else if (event.key === 'ArrowLeft' && navigationRef.current.count > 1) navigationRef.current.showPhoto(-1)
      else if (event.key === 'ArrowRight' && navigationRef.current.count > 1) navigationRef.current.showPhoto(1)
      else if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest('[role="dialog"]')
        const controls = [...(dialog?.querySelectorAll('button:not(:disabled)') || [])]
        if (!controls.length) return
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      window.requestAnimationFrame(() => enlargeRef.current?.focus())
    }
  }, [expanded])

  return <div className="product-gallery">
    <div className={`product-gallery-stage ${photos.length > 1 ? 'product-gallery-stage--multiple' : ''}`}>
      {photos.length > 1 && <div className="product-gallery-thumbs" role="group" aria-label="Product photos">
        {photos.map((src, i) => <button key={src} type="button" aria-label={`Show photo ${i + 1} of ${product.name}`} aria-pressed={src === active} onClick={() => setSelected(src)}>
          <ProductImage src={src} alt="" loading="lazy" decoding="async" />
        </button>)}
      </div>}
      <button
        ref={enlargeRef}
        className="product-gallery-main"
        type="button"
        aria-label={`Enlarge ${product.name} photo ${activeIndex + 1} of ${photos.length}`}
        onClick={() => setExpanded(true)}
      >
        <ProductImage src={active} alt={product.name} fetchPriority="high" decoding="async" />
        <span className="product-gallery-category">{category}</span>
        <span className="product-gallery-enlarge-hint" aria-hidden="true">View larger</span>
      </button>
    </div>
    {product.variantLabel && <p className="product-preview-label" aria-live="polite">{product.variantLabel}</p>}
    {active?.startsWith('/media/light-catalogue/') && <p className="product-preview-label">Illustrative preview. Natural colour and shape vary; size is not shown to scale.</p>}
    {expanded && <div className="product-lightbox-backdrop" onMouseDown={event => event.target === event.currentTarget && setExpanded(false)}>
      <div className="product-lightbox" role="dialog" aria-modal="true" aria-label={`${product.name} product photo viewer`}>
        <button ref={closeRef} className="product-lightbox-close" type="button" aria-label="Close photo viewer" onClick={() => setExpanded(false)}>×</button>
        {photos.length > 1 && <button className="product-lightbox-previous" type="button" aria-label="Previous photo" onClick={() => showPhoto(-1)}>‹</button>}
        <ProductImage src={active} alt={`${product.name}, photo ${activeIndex + 1} of ${photos.length}`} />
        {photos.length > 1 && <button className="product-lightbox-next" type="button" aria-label="Next photo" onClick={() => showPhoto(1)}>›</button>}
        <p>{activeIndex + 1} of {photos.length}</p>
      </div>
    </div>}
  </div>
}
