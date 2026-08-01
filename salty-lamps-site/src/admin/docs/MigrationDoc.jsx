// Migration — the production cutover runbook: moving Salty Lamps off Wix onto the
// owner's own Cloudflare + Stripe. Detailed, ordered, with real URLs. Complements
// deploy-production.sh + PRODUCTION-HANDOVER.md (the scripts that do the provisioning).
import React from 'react'
import { Figure, Callout } from './docParts.jsx'
import flowUrl from '../../../docs/diagrams/migration-flow.svg'

// Small helper for an external link.
const A = ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>

export default function MigrationDoc() {
  return (
    <article className="admin-doc">
      <p className="admin-doc__lead">
        A step-by-step runbook for taking Salty Lamps live: moving off Wix onto the owner's own
        Cloudflare and Stripe accounts. Follow the phases in order — everything up to the domain
        switch can be prepared without touching the live Wix shop.
      </p>

      <Callout tone="info" title="How this fits with the scripts">
        The Cloudflare provisioning (database, image storage, deploy) is automated by
        {' '}<code>deploy-production.sh</code> and documented in <code>PRODUCTION-HANDOVER.md</code>.
        This page is the wider human runbook around them — accounts, data, Stripe, and the domain.
      </Callout>

      <Figure
        src={flowUrl}
        alt="Seven migration phases: Cloudflare account, provision, migrate data, Stripe handoff, domain + email, cutover, decommission Wix."
        caption="The seven phases. Green = safe to prepare anytime; red = the live cutover; do Wix decommission last."
      />

      <Callout tone="warn" title="The golden rule">
        Keep the Wix shop <strong>live and untouched</strong> until the new site is fully tested on the
        real domain. Don't cancel Wix, delete Wix data, or remove DNS records until the switch is
        confirmed working. Migration is copy-then-switch, never move-and-hope.
      </Callout>

      <h2>Before you start — confirm these</h2>
      <ul className="admin-doc__list">
        <li>Who is the <strong>new owner</strong> (name, email, business/bank details for Stripe)?</li>
        <li>Is <strong>saltylamps.co.uk registered through Wix</strong>, or bought elsewhere and connected to Wix? (Changes the domain steps.)</li>
        <li>Is there <strong>email on the domain</strong> (e.g. info@saltylamps.co.uk via Wix/Google)? If so, its DNS records must be preserved — this is the #1 thing people break.</li>
        <li>Do you have <strong>login access to Wix</strong> (as domain/account owner) and to the current Stripe account?</li>
      </ul>

      <h2>Phase 1 — Set up the owner's Cloudflare account</h2>
      <p>Create a fresh Cloudflare account in the <em>owner's</em> name — production must live on their account, not the developer's.</p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Step</th><th>Where</th></tr></thead>
          <tbody>
            <tr><td>Sign up (owner's email)</td><td><A href="https://dash.cloudflare.com/sign-up">dash.cloudflare.com/sign-up</A></td></tr>
            <tr><td>Enable R2 (needs a card on file; free tier — see the Pricing page)</td><td>Dashboard → R2 Object Storage</td></tr>
            <tr><td>Note the Account ID (needed by the deploy script)</td><td>Dashboard → any domain → right sidebar</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Phase 2 — Provision the infrastructure (D1, R2, secrets, admin sign-in)</h2>
      <p>
        Run <code>./deploy-production.sh</code> with the owner's account (see <code>PRODUCTION-HANDOVER.md</code>). It
        creates the D1 database, the R2 bucket, applies the schema, seeds the catalogue, and deploys.
        Then set the admin sign-in and Stripe secrets.
      </p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Item</th><th>What / where</th></tr></thead>
          <tbody>
            <tr><td>D1 database</td><td>Created by the script; <A href="https://developers.cloudflare.com/d1/">D1 docs</A></td></tr>
            <tr><td>R2 image bucket</td><td>Created by the script; <A href="https://developers.cloudflare.com/r2/">R2 docs</A></td></tr>
            <tr><td>Admin sign-in (Cloudflare Access)</td><td>Set up a self-hosted Access app over <code>/admin</code>; add the owner's email. <A href="https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/">Access app guide</A> · <A href="https://one.dash.cloudflare.com">Zero Trust dashboard</A></td></tr>
            <tr><td>Set secrets <code>ACCESS_AUD</code>, <code>ACCESS_TEAM_DOMAIN</code></td><td><code>wrangler pages secret put</code></td></tr>
            <tr><td>Remove <code>DEV_ADMIN_BYPASS</code></td><td>Must NOT exist in production — it opens the admin to anyone</td></tr>
          </tbody>
        </table>
      </div>
      <Callout tone="warn" title="Admin must be locked in production">
        The dev/UAT site uses <code>DEV_ADMIN_BYPASS=1</code> for open testing. Production must instead use
        Cloudflare Access with the owner's email. Never carry the bypass into production.
      </Callout>

      <h2>Phase 3 — Migrate the data from Wix (catalogue, inventory, orders)</h2>
      <p>Export from Wix as CSV, then load into D1. The catalogue seed process already exists (<code>scripts/generate-d1-seed.mjs</code>).</p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Data</th><th>Export from Wix</th><th>Into Cloudflare</th></tr></thead>
          <tbody>
            <tr><td>Products &amp; variants</td><td><A href="https://support.wix.com/en/article/wix-stores-exporting-your-product-list">Export product list</A></td><td>Regenerate <code>d1/seed.sql</code>, apply to D1</td></tr>
            <tr><td>Inventory / stock levels</td><td>Included in the product export (per-SKU quantity)</td><td>Loaded with the catalogue; adjust in the admin Inventory page</td></tr>
            <tr><td>Orders history</td><td><A href="https://support.wix.com/en/article/exporting-orders-3126323">Export orders</A> (note: times are UTC; one row per order)</td><td>Optional — import as historical rows, or start fresh and keep the Wix export as an archive</td></tr>
          </tbody>
        </table>
      </div>
      <Callout tone="info" title="Decide: import historical orders, or start clean?">
        Past Wix orders were paid through Wix/its processor, not this Stripe account, so they can't be
        refunded or fulfilled from the new admin. Common choice: <strong>start orders fresh</strong> on the
        new site and keep the Wix orders CSV as a read-only archive. If you do import them, load them as
        historical records only.
      </Callout>

      <h2>Phase 4 — Hand off the Stripe account to the new owner</h2>
      <p>
        Two separate things: (a) transfer <em>account ownership</em>, and (b) update the <em>contact email,
        business and bank details</em> so payouts and tax sit with the new owner.
      </p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Task</th><th>Where / notes</th></tr></thead>
          <tbody>
            <tr><td>Transfer ownership</td><td>Dashboard → Team → add the new owner as <strong>Super Administrator</strong> → their row → <strong>Transfer ownership</strong>. Both parties are notified by email/SMS. <A href="https://support.stripe.com/questions/change-the-owner-of-a-stripe-account">Change the owner</A></td></tr>
            <tr><td>Change the account email</td><td>Done as part of / after the ownership transfer (the new owner's login becomes the account email)</td></tr>
            <tr><td>Update business + bank details</td><td>Settings → Business details &amp; Bank account &amp; payout — so money and tax go to the new owner</td></tr>
            <tr><td>Legal-entity change (if the business itself is being sold)</td><td>Needs Stripe support / KYC re-verification. <A href="https://support.stripe.com/questions/transfer-a-stripe-account-to-a-different-entity-due-to-a-business-sale-or-acquisition">Transfer to a different entity</A></td></tr>
            <tr><td>Live API keys</td><td>New owner creates their <strong>live</strong> secret key and sets <code>STRIPE_SECRET_KEY</code> as a Pages secret (they enter it — never share it)</td></tr>
            <tr><td>Re-point the webhook</td><td>Add a webhook endpoint <code>https://www.saltylamps.co.uk/api/webhook</code> for <code>checkout.session.completed</code>; put its signing secret in <code>STRIPE_WEBHOOK_SECRET</code></td></tr>
          </tbody>
        </table>
      </div>

      <h2>Phase 5 — Move the domain from Wix (the careful part)</h2>
      <Callout tone="warn" title="Inventory the DNS records FIRST">
        Before changing anything, write down every current DNS record at Wix — especially <strong>MX</strong>{' '}
        (email), <strong>TXT</strong> (SPF/DKIM/verification), and any subdomains. If you move the domain
        without recreating these, <strong>email stops working</strong>. This is the most common migration failure.
      </Callout>
      <p>There are two ways to point the domain at Cloudflare. Pick one:</p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Route</th><th>What it means</th><th>When to use</th></tr></thead>
          <tbody>
            <tr><td><strong>A. Change nameservers</strong> (recommended)</td><td>Add the domain to Cloudflare (it gives you 2 nameservers), recreate the DNS records there incl. email, then set those nameservers at Wix. Registration can stay at Wix. <A href="https://developers.cloudflare.com/dns/zone-setups/full-setup/">Full setup guide</A></td><td>Fastest route to Cloudflare hosting; reversible</td></tr>
            <tr><td><strong>B. Transfer the registration</strong></td><td>Move the domain registration out of Wix to Cloudflare Registrar (or another registrar). <A href="https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749">Transfer away from Wix</A> · <A href="https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/">Transfer to Cloudflare</A></td><td>Full ownership on Cloudflare; slower (~7 days)</td></tr>
          </tbody>
        </table>
      </div>
      <Callout tone="warn" title="Two UK-specific notes for .co.uk">
        <strong>1.</strong> Wix issues a transfer authorization (EPP) code when you request it and auto-unlocks
        the domain — but <strong>.co.uk domains are managed by Nominet and transfer via an “IPS tag” change,
        not a standard auth code</strong>, so the exact steps differ from .com. <strong>2.</strong> Confirm your
        chosen registrar supports <code>.co.uk</code> before committing to a transfer. If unsure, Route A
        (nameservers) avoids the transfer entirely.
      </Callout>
      <p>
        Then connect the domain to the site: in Cloudflare Pages add the custom domain
        {' '}<code>www.saltylamps.co.uk</code> (and the apex). Cloudflare issues the SSL certificate
        automatically. <A href="https://developers.cloudflare.com/pages/configuration/custom-domains/">Pages custom domains</A>
      </p>

      <h2>Phase 6 — Cutover &amp; verify</h2>
      <ul className="admin-doc__list">
        <li>Lower the domain's DNS <strong>TTL</strong> a day ahead so the switch propagates quickly.</li>
        <li>Flip the nameservers / finish the transfer. Propagation can take minutes to a few hours.</li>
        <li>Confirm the site loads on <code>www.saltylamps.co.uk</code> with a valid padlock (SSL).</li>
        <li>Confirm <strong>email still works</strong> (send + receive on the domain).</li>
        <li>Place one <strong>real low-value test order</strong> end-to-end; check it appears in the admin and in the owner's Stripe, then refund it.</li>
        <li>Confirm the admin requires Cloudflare Access sign-in (bypass is gone) and shows <strong>zero</strong> demo orders.</li>
        <li>Set <code>SITE_URL</code> to the production domain so Stripe redirects are correct.</li>
      </ul>

      <h2>Phase 7 — Decommission Wix</h2>
      <p>
        Only after everything above is confirmed working for a few days: cancel the Wix Premium/Store plan
        and any Wix email add-ons you've replaced. Keep the exported CSVs as an archive. If you used Route A
        and left the registration at Wix, you can transfer it out later at your leisure.
      </p>

      <h2>What people forget (the checklist)</h2>
      <ul className="admin-doc__list">
        <li>☐ DNS records inventoried before the switch (especially email MX + SPF/DKIM)</li>
        <li>☐ Cloudflare Access configured; <code>DEV_ADMIN_BYPASS</code> removed in production</li>
        <li>☐ Stripe webhook re-pointed to the production domain</li>
        <li>☐ <code>SITE_URL</code>, <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code> set as production secrets</li>
        <li>☐ Backups taken (Wix CSV exports + a D1 export) before cutover</li>
        <li>☐ A rollback plan: keep the old Wix nameservers noted so you can switch back if needed</li>
        <li>☐ Test purchase + refund done on the live domain</li>
        <li>☐ Wix cancelled <em>last</em>, only after days of confirmed operation</li>
      </ul>

      <p className="admin-doc__foot">
        This page is mirrored as Markdown at <code>docs/migration.md</code>. External steps link to the
        official Wix, Cloudflare, and Stripe help pages, which are the source of truth if their UIs change.
      </p>
    </article>
  )
}
