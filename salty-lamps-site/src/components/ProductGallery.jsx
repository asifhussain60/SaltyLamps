import React, { useState } from 'react'

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
  const active = photos.includes(selected) ? selected : product.image
  return <div className="product-gallery">
    <div className="product-gallery-main">
      <ProductImage src={active} alt={product.name} fetchPriority="high" decoding="async" />
      <span>{category}</span>
    </div>
    {product.variantLabel && <p className="product-preview-label" aria-live="polite">{product.variantLabel}</p>}
    {active?.startsWith('/media/light-catalogue/') && <p className="product-preview-label">Illustrative preview. Natural colour and shape vary; size is not shown to scale.</p>}
    {photos.length > 1 && <div className="product-gallery-thumbs" role="group" aria-label="Product photos">
      {photos.map((src, i) => <button key={src} type="button" aria-label={`Show photo ${i + 1} of ${product.name}`} aria-pressed={src === active} onClick={() => setSelected(src)}>
        <ProductImage src={src} alt="" loading="lazy" decoding="async" />
      </button>)}
    </div>}
  </div>
}
