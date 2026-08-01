// Pricing — a plain-English explanation of what it costs to run the live shop on
// Cloudflare + Stripe, and how Stripe's per-sale fee works. Non-technical, diagram-led.
// Figures reflect published pricing at time of writing; the official pages (linked at
// the foot) are the source of truth.
import React from 'react'
import { Figure, Callout } from './docParts.jsx'
import overviewUrl from '../../../docs/diagrams/pricing-overview.svg'
import splitUrl from '../../../docs/diagrams/payment-split.svg'

export default function PricingDoc() {
  return (
    <article className="admin-doc">
      <p className="admin-doc__lead">
        What does it actually cost to run the Salty Lamps shop once it's live? In short: hosting is
        effectively free for a shop this size, and you pay a small fee only when you make a sale.
      </p>

      <Callout tone="ok" title="The bottom line">
        <strong>Cloudflare</strong> (the website, database and image storage) costs roughly
        <strong> £0/month</strong> at this scale. <strong>Stripe</strong> has <strong>no monthly
        fee</strong> — it simply keeps a small cut of each payment (about <strong>1.5% + 20p</strong>{' '}
        on a UK card). So your running cost is essentially "a little bit per sale."
      </Callout>

      <h2>The two bills</h2>
      <p>There are only two things to pay for to keep the shop running, plus a small yearly cost for the domain name.</p>
      <Figure
        src={overviewUrl}
        alt="Cloudflare hosting is about £0/month on free tiers; Stripe has no monthly fee but takes 1.5% + 20p per UK card payment; plus a small yearly domain cost."
        caption="Hosting is basically free; payments cost a small percentage per sale."
      />

      <h2>How Stripe's fee works</h2>
      <p>
        Stripe takes its fee automatically out of each payment — a percentage of the sale plus a
        fixed 20p — and sends the rest to your bank account. The percentage depends on where the
        customer's card is from.
      </p>
      <Figure
        src={splitUrl}
        alt="On a £30 order: a UK card leaves you £29.35 (fee £0.65), a European card £29.05 (fee £0.95), an international card £28.82 (fee £1.18)."
        caption="A £30 order, by card type. You keep the green part; Stripe keeps the small red part."
      />
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Customer's card</th><th>Stripe fee</th><th>On a £30 sale, you keep</th></tr></thead>
          <tbody>
            <tr><td>UK card</td><td>1.5% + 20p</td><td>£29.35</td></tr>
            <tr><td>European (EEA) card</td><td>2.5% + 20p</td><td>£29.05</td></tr>
            <tr><td>International card</td><td>3.25% + 20p</td><td>£28.82</td></tr>
          </tbody>
        </table>
      </div>
      <Callout tone="info" title="One extra to know about">
        If a payment needs <strong>currency conversion</strong> (for example, charging in pounds to a
        card held in another currency), Stripe adds a further <strong>2%</strong>. Most UK sales won't
        hit this.
      </Callout>

      <h2>Cloudflare: free for a shop this size</h2>
      <p>
        Everything Cloudflare provides for the shop sits comfortably inside its free allowances, so
        there's normally nothing to pay:
      </p>
      <ul className="admin-doc__list">
        <li><strong>Website hosting &amp; the behind-the-scenes functions</strong> — free up to 100,000 visits' worth of requests per day.</li>
        <li><strong>The database</strong> (products, stock, orders) — free up to millions of reads a day and 5&nbsp;GB of data.</li>
        <li><strong>Image storage</strong> — free up to 10&nbsp;GB (a shop's photos are a fraction of that).</li>
        <li><strong>Admin sign-in security</strong> (Cloudflare Access) — free for a small team.</li>
      </ul>
      <p>
        You'd only ever pay Cloudflare if the shop became very busy and outgrew those free limits —
        at which point the paid plan starts at about <strong>$5/month</strong>. For a growing small
        shop, that's a long way off.
      </p>

      <h2>A simple monthly picture</h2>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>What</th><th>When you pay</th><th>Rough cost</th></tr></thead>
          <tbody>
            <tr><td>Cloudflare (hosting, database, images, admin security)</td><td>Monthly</td><td>≈ £0 at this scale</td></tr>
            <tr><td>Stripe (card payments)</td><td>Per sale</td><td>~1.5% + 20p per UK sale</td></tr>
            <tr><td>Domain name (e.g. saltylamps.co.uk)</td><td>Yearly</td><td>A few pounds a year</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Buying or moving the domain</h2>
      <p>
        The shop already owns <strong>saltylamps.co.uk</strong> (currently registered at Wix). There are
        two things to know about the cost:
      </p>
      <ul className="admin-doc__list">
        <li><strong>Moving it to Cloudflare is free.</strong> <code>.co.uk</code> (and other <code>.uk</code>) domains have <strong>no transfer fee</strong> and moving them doesn't add a year — so shifting the domain from Wix to Cloudflare costs <strong>£0</strong>. You simply keep paying the normal yearly renewal.</li>
        <li><strong>The yearly renewal is small</strong> — a <code>.co.uk</code> is typically a few pounds a year (roughly <strong>£8–£12/year</strong> at most registrars; Cloudflare charges at cost, with no markup).</li>
        <li>If you ever register a brand-new domain instead of moving this one, it's the same kind of small yearly fee.</li>
      </ul>
      <Callout tone="info" title="How to actually move it">
        The step-by-step for moving the domain (and everything else) to the live setup is in the
        <strong> Migration</strong> page of this Documentation section.
      </Callout>

      <Callout tone="warn" title="Prices can change — always check the official pages">
        The figures here were accurate when written but providers update their pricing. Confirm current
        rates on the official pages: <a href="https://stripe.com/gb/pricing" target="_blank" rel="noreferrer">Stripe UK pricing</a>,
        {' '}<a href="https://developers.cloudflare.com/workers/platform/pricing/" target="_blank" rel="noreferrer">Cloudflare Workers/Pages</a>,
        {' '}<a href="https://developers.cloudflare.com/d1/platform/pricing/" target="_blank" rel="noreferrer">Cloudflare D1</a>,
        {' '}and <a href="https://developers.cloudflare.com/r2/pricing/" target="_blank" rel="noreferrer">Cloudflare R2</a>.
      </Callout>

      <p className="admin-doc__foot">
        This page is mirrored as Markdown at <code>docs/pricing.md</code>.
      </p>
    </article>
  )
}
