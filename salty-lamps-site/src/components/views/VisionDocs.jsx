import React from 'react'

export default function VisionDocs() {
  return (
    <div className="section-wrap">
      <div className="hero-title">
        <h2>Vision &amp; Extracted Documents</h2>
        <p className="sub">
          Everything recovered from the four uploaded Apple Pages files, customer review
          screenshots, and voice memo.
        </p>
      </div>

      <div className="doc-card">
        <div className="doc-card-header">
          <div className="doc-label">Vision.pages</div>
        </div>
        <div className="doc-card-body">
          <h4>Owner&rsquo;s Vision — verbatim</h4>
          <blockquote>
            &ldquo;We are manufacturers for the Himalayan Salt Products. Would be interested in
            selling to trade / wholesale business as bulk supplies, as well as to consumers as
            individual buyers. [Web]site needs to be compatible with Mobile / tablet / Desktop.
            Prefer [a] new design and ready for a change.&rdquo;
          </blockquote>
        </div>
      </div>

      <div className="doc-card green">
        <div className="doc-card-header">
          <div className="doc-label">Manufacturing process.pages</div>
        </div>
        <div className="doc-card-body">
          <h4>The Supply Chain — verbatim extract</h4>
          <p>
            This is the brand&rsquo;s biggest differentiator. No UK competitor has a documented
            manufacturing story.
          </p>
          <blockquote>
            &ldquo;Raw material (rock salt) is extracted from mines and loaded onto trucks.
            The trucks deliver [it] to our warehouse in Karachi. [It is then] washed and dried
            [and] segregated according [to grade/size]&hellip;&rdquo;
          </blockquote>
        </div>
      </div>

      <div className="two-col">
        <div className="doc-card purple">
          <div className="doc-card-header">
            <div className="doc-label">Return &amp; Exchange Policy on Web.pages</div>
          </div>
          <div className="doc-card-body">
            <h4>Returns Policy — June 2020</h4>
            <p>
              Standard policy, 5 years old. Must be updated for UK Consumer Rights Act 2015
              compliance before launch.
            </p>
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-header">
            <div className="doc-label">Salty Lamps Price List 2025.pages</div>
          </div>
          <div className="doc-card-body">
            <h4>Trade Wholesale Price List</h4>
            <p>
              Partial extraction: TC-1 candle holders at £2.20/unit, CUL-100 culinary salt pouches
              at £1.25. Populates the B2B portal price download.
            </p>
          </div>
        </div>
      </div>

      <div className="doc-card green">
        <div className="doc-card-header">
          <div className="doc-label">Customer Reviews (2014–2016)</div>
        </div>
        <div className="doc-card-body">
          <h4>5 Real Reviews — Key Themes</h4>
          <p>
            Fast delivery in 4 of 6 reviews. Healthcare professional recommends to patients.
            Culinary salt cited for blood pressure. Repeat purchasing and gifting confirmed.
          </p>
          <blockquote>
            &ldquo;Recommending you to all my patients. Excellent service time after time.&rdquo;
            — Simon D., healthcare professional
          </blockquote>
        </div>
      </div>

      <div className="doc-card navy">
        <div className="doc-card-header">
          <div className="doc-label">Voice Memo — 31 May 2026</div>
        </div>
        <div className="doc-card-body">
          <h4>Promotional Pricing + Responsive Bug Report</h4>
          <p>
            Offers requested: Buy 1 Get 1 Half Price &middot; Buy 2 Get 1 Free &middot;
            Buy 3 Get 1 Free. Documented bugs: column shift on page navigation, inconsistent
            mobile hamburger icon.
          </p>
        </div>
      </div>

      <div className="bor" />

      <div className="service-card">
        <div className="card-label">Live site inspection</div>
        <h4>Current Hosting — saltylamps.co.uk</h4>
        <ul>
          <li>
            <strong>Platform:</strong> Wix.com — being replaced entirely by new stack
          </li>
          <li>
            <strong>Domain:</strong> saltylamps.co.uk — registrar unknown, to confirm for
            DNS migration
          </li>
          <li>
            <strong>Social links:</strong> point to Wix&rsquo;s own accounts, not Salty Lamps
            brand pages (live bug — fix immediately)
          </li>
          <li>
            <strong>Meta keywords:</strong> &ldquo;Quality, Home, Goods&rdquo; — no salt-specific
            terms, completely ineffective
          </li>
        </ul>
      </div>
    </div>
  )
}
