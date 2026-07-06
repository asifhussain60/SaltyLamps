import React from 'react'

export default function HomepageJourney() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Homepage &amp; the 3-Click Journey</h2>
        <p className="sub">
          Every section has a single job. Visitors go from &ldquo;who are you?&rdquo; to
          &ldquo;add to cart&rdquo; in three clicks.
        </p>
      </div>

      <div className="cta-box">
        <p>
          <strong>Design principle:</strong> Lead with a feeling, not a product. The hero does
          not show a product grid — it shows atmosphere. Warm amber light, dark room, the
          feeling of calm. The product is the second thing the visitor sees. The emotion is
          the first. This approach reduces bounce and increases average session time.
        </p>
      </div>

      <div className="afeature-grid afeature-grid-3col" style={{ maxWidth: 640, margin: '0 auto 28px' }}>
        {[
          { icon: '🖱️', title: 'Click 1', sub: 'Hero → Collection', desc: '"Shop Salt Lamps" lands in most popular category' },
          { icon: '👁️', title: 'Click 2', sub: 'Card → Product Detail', desc: 'Gallery, benefits, variants, Add to Cart' },
          { icon: '🛒', title: 'Click 3', sub: 'Add to Cart → Checkout', desc: 'Apple Pay / Google Pay, guest checkout' },
        ].map(item => (
          <div key={item.title} className="afeature-wrap">
            <div className="afeature">
              <div className="afmatter">
                <span className="af-icon" style={{ fontSize: 32 }}>{item.icon}</span>
                <h5>{item.title}</h5>
                <p>{item.sub}</p>
              </div>
            </div>
            <div className="af-label">{item.sub}</div>
            <div className="af-sub">{item.desc}</div>
          </div>
        ))}
      </div>

      <div className="bor" />

      <h4 style={{ fontFamily: 'Oswald, sans-serif', color: '#555', marginBottom: 16 }}>
        Homepage wireframe — section by section
      </h4>

      <div className="wireframe">
        <div className="wf-browser-bar">
          <div className="wf-dot" style={{ background: '#ff5f57' }} />
          <div className="wf-dot" style={{ background: '#febc2e' }} />
          <div className="wf-dot" style={{ background: '#28c840' }} />
          <div className="wf-url">saltylamps.co.uk</div>
        </div>

        {/* Hero section */}
        <div className="wf-hero">
          <div className="wf-tag">&#9654; ambient video loop — glowing lamp in dark room</div>
          <h3>Handcrafted Himalayan Salt — Direct from Source</h3>
          <p style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: 12 }}>
            Manufacturer since [year]. Thousands of UK customers.
          </p>
          <div>
            <span className="wf-btn">Shop Salt Lamps &rarr;</span>
            <span className="wf-btn outline">Explore All Products</span>
          </div>
          <div className="wf-trust">
            <span>&#10003; Fast UK Delivery</span>
            <span>&#10003; Manufacturer Direct</span>
            <span>&#10003; 5&#9733; Reviews</span>
            <span>&#10003; Secure Checkout</span>
          </div>
        </div>

        {/* Bestsellers section */}
        <div className="wf-section">
          <div className="wf-section-label">Section 2 — Bestsellers with offer badges</div>
          <div className="wf-grid">
            <div className="wf-product">
              <div className="wf-img" />
              <div className="wf-name">Natural Crystal Lamp</div>
              <div className="wf-price">£11.99</div>
              <div className="wf-offer">Buy 1 Get 1 Half Price</div>
            </div>
            <div className="wf-product">
              <div className="wf-img" />
              <div className="wf-name">Candle Holders</div>
              <div className="wf-price">£10.00</div>
              <div className="wf-offer">3 for 2</div>
            </div>
            <div className="wf-product">
              <div className="wf-img" />
              <div className="wf-name">Salt Platter</div>
              <div className="wf-price">£8.00</div>
            </div>
            <div className="wf-product">
              <div className="wf-img" />
              <div className="wf-name">Bath Salts</div>
              <div className="wf-price">£5.00</div>
            </div>
          </div>
        </div>

        {/* Reviews section */}
        <div className="wf-section">
          <div className="wf-section-label">Section 3 — 5 real customer reviews</div>
          <div className="wf-reviews">
            <div className="wf-review">
              <div className="wf-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p style={{ margin: 0 }}>Recommending to all my patients. Excellent service.</p>
              <small style={{ color: '#666' }}>— Simon D., healthcare professional</small>
            </div>
            <div className="wf-review">
              <div className="wf-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p style={{ margin: 0 }}>Fast delivery, beautifully packaged. Will order again.</p>
              <small style={{ color: '#666' }}>— Verified buyer</small>
            </div>
            <div className="wf-review">
              <div className="wf-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p style={{ margin: 0 }}>Third order now — the quality is consistent every time.</p>
              <small style={{ color: '#666' }}>— Repeat customer</small>
            </div>
          </div>
        </div>

        {/* B2B strip */}
        <div className="wf-section">
          <div className="wf-section-label">Section 4 — B2B callout strip</div>
          <div className="wf-b2b-strip">
            Are you a spa, butcher, equestrian centre or hospitality business?
            &nbsp;<strong>Trade enquiries welcome &rarr;</strong>
          </div>
        </div>
      </div>

      <div className="bor" />

      <div className="two-col">
        <div className="service-card">
          <div className="card-label">Above the fold — mandatory</div>
          <h4>Must appear above the fold</h4>
          <ul>
            <li>Brand tagline (6–8 words max)</li>
            <li>Single primary CTA button</li>
            <li>UK delivery trust signal</li>
            <li>Social proof indicator (star rating or review count)</li>
            <li>Ambient video or strong hero image</li>
          </ul>
        </div>
        <div className="service-card">
          <div className="card-label">Above the fold — prohibited</div>
          <h4>Must NOT appear above the fold</h4>
          <ul>
            <li>Full product grid</li>
            <li>8+ navigation items (max 5 visible)</li>
            <li>Multiple CTAs competing for attention</li>
            <li>Large text blocks or paragraphs</li>
            <li>Popup on first visit (GDPR overlay excluded)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
