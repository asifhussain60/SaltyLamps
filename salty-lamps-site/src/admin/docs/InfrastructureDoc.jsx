// Infrastructure — the plain-English "what hosts the shop and what each service does"
// page. Written for a non-technical reader (owner / stakeholder). Diagram-led.
import React from 'react'
import { Figure, Callout } from './docParts.jsx'
import archUrl from '../../../docs/diagrams/system-architecture.svg'
import checkoutUrl from '../../../docs/diagrams/checkout-flow.svg'
import authUrl from '../../../docs/diagrams/admin-auth.svg'

export default function InfrastructureDoc() {
  return (
    <article className="admin-doc">
      <p className="admin-doc__lead">
        This page explains, in plain terms, what runs the Salty Lamps website — the services it
        uses, what each one does, and roughly what it costs. No technical background needed.
      </p>

      <Callout tone="info" title="The one-sentence version">
        The entire site runs on <strong>Cloudflare</strong> (hosting, database, image storage and
        admin security), and <strong>Stripe</strong> handles card payments. There are no other
        servers to manage.
      </Callout>

      <h2>The big picture</h2>
      <p>
        A shopper's web browser only ever talks to Cloudflare. Behind the scenes, small Cloudflare
        programs fetch products from the database, serve images, and hand payments to Stripe.
      </p>
      <Figure
        src={archUrl}
        alt="System architecture: the browser talks to Cloudflare Pages, which talks to D1, R2, Stripe and Cloudflare Access."
        caption="How the pieces connect. Solid lines are what shoppers do; dashed lines are admin-only."
      />

      <h2>What each service is — and what it costs</h2>
      <div className="admin-doc__cards">
        <div className="admin-doc__card">
          <h3>☁️ Cloudflare Pages</h3>
          <p>Hosts the website itself and delivers it fast from data centres worldwide. This is the "home" of the shop.</p>
          <p className="admin-doc__cost">Free tier covers this site.</p>
        </div>
        <div className="admin-doc__card">
          <h3>⚙️ Cloudflare Functions</h3>
          <p>Small programs that run when needed — loading products, taking checkout, confirming payments, and powering the admin area.</p>
          <p className="admin-doc__cost">Included with Pages; free tier is generous.</p>
        </div>
        <div className="admin-doc__card">
          <h3>🗄️ D1 database</h3>
          <p>The shop's memory: every product, price, stock level and order lives here.</p>
          <p className="admin-doc__cost">Free tier covers this site.</p>
        </div>
        <div className="admin-doc__card">
          <h3>🖼️ R2 storage</h3>
          <p>Holds product photos that you upload through the admin. (Existing catalogue images are part of the site itself.)</p>
          <p className="admin-doc__cost">Free up to 10&nbsp;GB — far more than this shop needs.</p>
        </div>
        <div className="admin-doc__card">
          <h3>💳 Stripe</h3>
          <p>Takes card payments on its own secure page. The shop never sees or stores card numbers.</p>
          <p className="admin-doc__cost">Stripe's standard per-transaction fee applies.</p>
        </div>
        <div className="admin-doc__card">
          <h3>🛡️ Cloudflare Access</h3>
          <p>The lock on the admin door — decides who is allowed into this admin area.</p>
          <p className="admin-doc__cost">Free for a small number of admins.</p>
        </div>
      </div>

      <h2>How a purchase works</h2>
      <p>
        The important thing to know: card details are only ever entered on Stripe's own page, never
        on the shop. Once Stripe confirms payment, it tells the site to record the order.
      </p>
      <Figure
        src={checkoutUrl}
        alt="Checkout flow: shopper clicks pay, the site creates a Stripe session, the shopper pays on Stripe, Stripe notifies the site, and the order is saved."
        caption="From “Pay” to a saved, paid order. Stripe handles the money; the site records the result."
      />

      <h2>How the admin area is protected</h2>
      <p>
        This admin portal is separated from the public shop. In the real (production) setup,
        Cloudflare Access asks anyone trying to enter to sign in first, and the site double-checks
        that sign-in on every action.
      </p>
      <Figure
        src={authUrl}
        alt="Admin auth: Cloudflare Access signs the admin in and issues a pass, which the site verifies on every admin request."
        caption="Only signed-in, approved people reach the admin data."
      />
      <Callout tone="warn" title="A note about the current test site">
        The current <em>dev / UAT</em> site has this lock switched off on purpose, so testers can
        try the admin freely. On the real shop this must be switched back on — see the Technical
        Documentation for the exact setting.
      </Callout>

      <h2>Two separate environments</h2>
      <p>There are two independent copies of the shop, so testing never touches real customers:</p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead>
            <tr><th></th><th>Dev / UAT (testing)</th><th>Production (the real shop)</th></tr>
          </thead>
          <tbody>
            <tr><td>Purpose</td><td>Trying out changes safely</td><td>Real customers &amp; real orders</td></tr>
            <tr><td>Orders shown</td><td>Simulated demo orders</td><td>Only genuine orders</td></tr>
            <tr><td>Payments</td><td>Test payments</td><td>Live Stripe payments</td></tr>
            <tr><td>Cloudflare account</td><td>The developer's account</td><td>The owner's own account</td></tr>
          </tbody>
        </table>
      </div>
      <p className="admin-doc__foot">
        When the shop moves to production, it runs entirely on the owner's own Cloudflare and Stripe
        accounts, so the owner controls hosting, data and payments end-to-end.
      </p>
    </article>
  )
}
