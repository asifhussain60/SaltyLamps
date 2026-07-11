// Technical Documentation — a complete engineering reference for the Salty Lamps
// application. Grounded in the actual code (verified file-by-file), so a new engineer
// can understand and safely extend the site from this one page.
import React from 'react'
import { Figure, Callout } from './docParts.jsx'
import archUrl from '../../../docs/diagrams/system-architecture.svg'
import dataModelUrl from '../../../docs/diagrams/data-model.svg'
import checkoutUrl from '../../../docs/diagrams/checkout-flow.svg'
import authUrl from '../../../docs/diagrams/admin-auth.svg'

export default function TechnicalDoc() {
  return (
    <article className="admin-doc">
      <p className="admin-doc__lead">
        A full technical account of the application: stack, architecture, data model, API surface,
        auth, build/deploy, and a guide to making common changes. Everything here reflects the
        current code, including a few things worth knowing before you touch them.
      </p>

      <h2>1. Overview &amp; tech stack</h2>
      <p>
        Salty Lamps is a single React application that serves both the public storefront and the
        admin portal, deployed to <strong>Cloudflare Pages</strong>. The backend is a set of
        Cloudflare <strong>Pages Functions</strong> (file-based routes under <code>functions/api/</code>),
        backed by <strong>D1</strong> (SQLite) for data, <strong>R2</strong> for uploaded images, and
        <strong> Stripe Checkout</strong> for payments. Admin routes are gated by Cloudflare Access.
      </p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Layer</th><th>Technology</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>UI</td><td>React 18, Vite 5</td><td>One SPA; storefront + admin in the same bundle</td></tr>
            <tr><td>Routing</td><td>Hand-rolled <code>history.pushState</code></td><td>No router library; string-parses <code>location.pathname</code></td></tr>
            <tr><td>Styling</td><td>Hand-written CSS + design tokens</td><td>See the styling note below — Tailwind is configured but unused</td></tr>
            <tr><td>Hosting / API</td><td>Cloudflare Pages + Pages Functions</td><td>File-path = route under <code>functions/api/</code></td></tr>
            <tr><td>Database</td><td>Cloudflare D1 (SQLite)</td><td>Binding <code>DB</code></td></tr>
            <tr><td>Object storage</td><td>Cloudflare R2</td><td>Binding <code>IMAGES</code>; admin-uploaded photos</td></tr>
            <tr><td>Payments</td><td>Stripe Checkout + webhook</td><td>Server-side only; no card data touches the app</td></tr>
            <tr><td>Admin auth</td><td>Cloudflare Access (Zero Trust)</td><td>RS256 JWT verified in middleware</td></tr>
            <tr><td>Peripheral</td><td>Supabase</td><td>Optional enquiry/notes persistence only — not the shop data</td></tr>
          </tbody>
        </table>
      </div>

      <h2>2. Repository layout</h2>
      <pre className="admin-doc__tree">{`salty-lamps-site/
├─ index.html                 SPA entry
├─ vite.config.js             build + /api dev proxy → wrangler (port 8788)
├─ wrangler.toml              Pages config: D1 (DB) + R2 (IMAGES) bindings
├─ src/
│  ├─ main.jsx                mounts <App>, imports the two stylesheets
│  ├─ App.jsx                 storefront SPA (routing + all shopper views)
│  ├─ admin/
│  │  ├─ AdminApp.jsx         admin SPA (dashboard, orders, catalog, inventory, reports, docs)
│  │  └─ docs/                these documentation pages
│  ├─ components/             DonutChart (live); the rest is an older proposal deck (unused)
│  ├─ lib/supabase.js         optional Supabase client
│  └─ styles/                 saltylamps.css (storefront) + admin.css (portal)
├─ functions/
│  ├─ api/                    Pages Functions (public + admin endpoints)
│  └─ lib/                    flatten-products, admin-helpers, validation (shared)
├─ d1/                        schema.sql, migrations/, seed.sql, demo/reset SQL
├─ docs/                      these docs as Markdown + diagrams/*.svg (single source)
└─ scripts/                   generate-seo.mjs, uat-refresh.sh, deploy helpers`}</pre>

      <h2>3. Runtime architecture</h2>
      <Figure src={archUrl} alt="Browser ↔ Cloudflare Pages ↔ Functions ↔ D1 / R2 / Stripe / Access." caption="The browser only talks to Cloudflare Pages; Functions reach the data services." />

      <h2>4. Frontend</h2>
      <p>
        <strong>Routing.</strong> There is no router library. <code>App.jsx</code> reads
        <code> window.location.pathname</code>, holds it in state, and listens for <code>popstate</code>;
        navigation calls <code>history.pushState</code> and dispatches a synthetic <code>popstate</code>.
        The route string is parsed into a view via string matching. When the path starts with
        <code> /admin</code>, <code>App.jsx</code> returns <code>&lt;AdminApp route={'{route}'} /&gt;</code> early,
        and <code>AdminApp</code> repeats the same scheme for its own sub-routes.
      </p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Route</th><th>View</th></tr></thead>
          <tbody>
            <tr><td><code>/</code></td><td>Home</td></tr>
            <tr><td><code>/shop</code>, <code>/category/:slug</code>, <code>/collection/:slug</code></td><td>Shop listing</td></tr>
            <tr><td><code>/product-page/:slug</code></td><td>Product detail</td></tr>
            <tr><td><code>/checkout/success</code>, <code>/checkout/cancelled</code></td><td>Post-payment pages</td></tr>
            <tr><td><code>/gallery</code>, <code>/reviews</code>, <code>/process</code>, policy pages</td><td>Static content</td></tr>
            <tr><td><code>/admin/*</code></td><td>Admin SPA (see §6)</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>Data.</strong> The storefront fetches <code>GET /api/products</code> and starts payment
        with <code>POST /api/checkout</code> (body <code>{'{ items: [{ skuId, quantity }] }'}</code> — no
        client-supplied prices). <strong>Components:</strong> the only shared component still wired in
        is <code>DonutChart.jsx</code> (used by the admin dashboard).
      </p>
      <Callout tone="warn" title="Styling reality (verify before assuming)">
        Styling is <strong>hand-written CSS</strong> in <code>src/styles/saltylamps.css</code> and
        <code> admin.css</code>, built on a shared CSS-custom-property design-token system.
        <strong> Tailwind is configured but not actually used</strong> (no <code>@tailwind</code>
        directives in the stylesheets), and <strong>Bootstrap is a dependency but imported nowhere</strong>
        — both are effectively dead and safe to remove. An older "proposal deck" subtree under
        <code> src/components/views/</code> is also orphaned (not imported by the shipped app).
      </Callout>

      <h2>5. Backend — API surface</h2>
      <p>Pages Functions; the file path is the route. Handlers export <code>onRequestGet/Post/Patch/Delete</code>.</p>
      <h3>Public endpoints</h3>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Route</th><th>Method</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>/api/products</code></td><td>GET</td><td>Flattened visible catalogue (one card per SKU); 60s cache</td></tr>
            <tr><td><code>/api/checkout</code></td><td>POST</td><td>Re-verifies price/stock in D1, creates a Stripe Checkout Session, returns its URL</td></tr>
            <tr><td><code>/api/webhook</code></td><td>POST</td><td>Stripe webhook; on <code>checkout.session.completed</code> writes the order and decrements stock (idempotent)</td></tr>
            <tr><td><code>/api/images/*</code></td><td>GET</td><td>Serves R2-stored uploaded images; 1-year immutable cache, ETag</td></tr>
          </tbody>
        </table>
      </div>
      <h3>Admin endpoints (all behind <code>_middleware.js</code>)</h3>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Route</th><th>Methods</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>/api/admin/stats</code></td><td>GET</td><td>Dashboard batch: revenue, counts, stock alerts, 14-day series, comparisons</td></tr>
            <tr><td><code>/api/admin/orders</code></td><td>GET</td><td>Filter/paginate orders with item counts</td></tr>
            <tr><td><code>/api/admin/orders/:id</code></td><td>GET, PATCH</td><td>Order detail; update fulfilment/tracking, or refund/cancel (real Stripe refund)</td></tr>
            <tr><td><code>/api/admin/orders/by-month</code>, <code>/by-year</code></td><td>GET</td><td>Paid orders grouped by period</td></tr>
            <tr><td><code>/api/admin/products</code></td><td>GET, POST</td><td>List all (incl. hidden) with SKUs; create product + ≥1 SKU</td></tr>
            <tr><td><code>/api/admin/products/:id</code></td><td>PATCH, DELETE</td><td>Update; delete (blocked if a SKU appears on orders)</td></tr>
            <tr><td><code>/api/admin/products/:id/skus</code></td><td>POST</td><td>Add a SKU/variant</td></tr>
            <tr><td><code>/api/admin/products/:id/image</code></td><td>POST</td><td>Upload image (type-sniffed, ≤2MB) to R2, update <code>products.image</code></td></tr>
            <tr><td><code>/api/admin/skus/:id</code></td><td>PATCH, DELETE</td><td>Update; delete (blocked if on orders or the last SKU)</td></tr>
            <tr><td><code>/api/admin/inventory</code></td><td>PATCH</td><td>Bulk stock update (≤500 lines), validated per SKU track mode</td></tr>
            <tr><td><code>/api/admin/reports/sales</code></td><td>GET</td><td>Daily paid series + totals; <code>?format=csv</code></td></tr>
            <tr><td><code>/api/admin/reports/top-products</code></td><td>GET</td><td>Best sellers + revenue by category; CSV</td></tr>
            <tr><td><code>/api/admin/reports/inventory-valuation</code></td><td>GET</td><td>Stock-on-hand value, low/out-of-stock; CSV</td></tr>
          </tbody>
        </table>
      </div>

      <h2>6. Admin SPA</h2>
      <p>
        <code>AdminApp.jsx</code> renders the sidebar shell and dispatches to page components:
        <code> Dashboard</code>, <code>OrdersList</code>/<code>OrderDetail</code>,
        <code> ProductsList</code>/<code>ProductEdit</code>, <code>Inventory</code>, <code>Reports</code>,
        <code> Settings</code>, and these <code>docs</code> pages. Shared helpers: <code>Icon</code>
        (inline-SVG set), <code>AdminLink</code>/<code>navigate</code> (pushState), <code>usePageData</code>
        (fetch hook), and <code>api()</code> (fetch wrapper with structured errors). Admin forms import
        the same <code>validation.mjs</code> the server uses, so client and server rules never diverge.
      </p>

      <h2>7. Shared modules (<code>functions/lib/</code>)</h2>
      <ul className="admin-doc__list">
        <li><strong>flatten-products.mjs</strong> — the products+SKUs query and row-flattener, shared by <code>api/products.js</code> and the build-time SEO generator.</li>
        <li><strong>admin-helpers.mjs</strong> — response helpers (<code>json</code>, <code>apiError</code>), the audit-log insert, CSV helpers, day-series zero-fill.</li>
        <li><strong>validation.mjs</strong> — single source of truth for input rules and money conversion; imported by both the Functions and the admin UI.</li>
      </ul>

      <h2>8. Data model</h2>
      <Figure src={dataModelUrl} alt="Entity-relationship diagram of products, skus, orders, order_items, admin_audit." caption="Five tables. Note D1 does not enforce foreign keys — the app enforces them with delete guards." />
      <ul className="admin-doc__list">
        <li><strong>products</strong> → has many <strong>skus</strong> (<code>skus.product_id</code>).</li>
        <li><strong>orders</strong> → has many <strong>order_items</strong> (<code>order_items.order_id</code>); each item references one <strong>sku</strong> (<code>order_items.sku_id</code>) and snapshots its price.</li>
        <li><strong>admin_audit</strong> — append-only log of every admin write (actor email + action).</li>
      </ul>
      <Callout tone="warn" title="Two schema gotchas">
        <code>skus.sku</code> is deliberately <strong>not unique</strong> (the source catalogue reuses codes),
        so <code>order_items</code> references the surrogate <code>skus.id</code>. And <strong>D1 does not
        enforce foreign keys</strong>, which is why deletes are guarded in code.
      </Callout>

      <h2>9. Authentication</h2>
      <Figure src={authUrl} alt="Cloudflare Access issues a signed JWT; the admin middleware verifies it on every request." caption="Cloudflare Access + per-request JWT verification in _middleware.js." />
      <p>
        <code>functions/api/admin/_middleware.js</code> runs on every <code>/api/admin/*</code> request. It
        reads the Access JWT (<code>Cf-Access-Jwt-Assertion</code> header or <code>CF_Authorization</code>
        cookie), requires <strong>RS256</strong>, fetches and caches the team <strong>JWKS</strong>, verifies
        the signature, issuer, expiry, and <strong>audience</strong> (<code>ACCESS_AUD</code>), then exposes
        the caller's email for audit logging. It <strong>fails closed</strong>: if <code>ACCESS_AUD</code> or
        <code> ACCESS_TEAM_DOMAIN</code> is missing it returns 503 rather than serving admin data.
      </p>
      <Callout tone="warn" title="DEV_ADMIN_BYPASS">
        If the secret <code>DEV_ADMIN_BYPASS=1</code> is set, the middleware skips all checks and treats the
        caller as <code>dev@localhost</code>. Intended for local dev and the DEV/UAT site only.
        <strong> Never set it in production</strong> — it leaves the admin open to anyone with the URL.
      </Callout>

      <h2>10. Checkout &amp; payments</h2>
      <Figure src={checkoutUrl} alt="Checkout: create Stripe session → pay on Stripe → webhook → save order." caption="checkout.js creates the session; webhook.js records the paid order." />
      <p>
        <code>checkout.js</code> re-checks every line against D1 (price + stock) before creating the Stripe
        Checkout Session — the client never supplies prices. <code>webhook.js</code> verifies the Stripe
        signature and, on <code>checkout.session.completed</code>, writes <code>orders</code> +
        <code> order_items</code> and decrements quantity-tracked stock, idempotently.
      </p>

      <h2>11. Build &amp; deploy pipeline</h2>
      <ul className="admin-doc__list">
        <li><strong>Dev:</strong> <code>vite</code> serves the SPA and proxies <code>/api</code> to a local <code>wrangler pages dev</code> (port 8788). Run both for full-stack local testing.</li>
        <li><strong>Build:</strong> <code>npm run build</code> = <code>vite build</code> then <code>scripts/generate-seo.mjs</code>, which prerenders per-route HTML shells (title/description/canonical/OG/JSON-LD), plus <code>robots.txt</code> and sitemaps. <code>/admin/*</code> is excluded from prerender and sitemaps.</li>
        <li><strong>Deploy (dev/UAT):</strong> <code>./deploy-cloudflare.sh</code> → <code>wrangler pages deploy dist</code> to the <code>salty-lamps-proposal</code> project (hotmail account).</li>
        <li><strong>Deploy (production):</strong> <code>./deploy-production.sh</code> — account-agnostic; provisions D1 + R2 on the owner's own account, catalog-only seed, then the owner attaches their own live Stripe keys. See <code>PRODUCTION-HANDOVER.md</code>.</li>
      </ul>

      <h2>12. Environments &amp; secrets</h2>
      <p>Secrets are set with <code>wrangler pages secret put</code> (never committed):</p>
      <div className="admin-doc__table-wrap">
        <table className="admin-doc__table">
          <thead><tr><th>Secret / var</th><th>Used by</th></tr></thead>
          <tbody>
            <tr><td><code>STRIPE_SECRET_KEY</code></td><td>checkout, webhook, refunds</td></tr>
            <tr><td><code>STRIPE_WEBHOOK_SECRET</code></td><td>webhook signature verification</td></tr>
            <tr><td><code>SITE_URL</code></td><td>Stripe success/cancel redirects</td></tr>
            <tr><td><code>ACCESS_AUD</code>, <code>ACCESS_TEAM_DOMAIN</code></td><td>admin auth middleware</td></tr>
            <tr><td><code>DEV_ADMIN_BYPASS</code></td><td>dev/UAT admin bypass (never in prod)</td></tr>
            <tr><td><code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code></td><td>optional enquiry persistence (build-time, in <code>.env.local</code>)</td></tr>
          </tbody>
        </table>
      </div>

      <h2>13. How to make common changes</h2>
      <ul className="admin-doc__list">
        <li><strong>Add a product field:</strong> add the column in <code>d1/schema.sql</code> + a migration; update <code>validation.mjs</code>, the admin <code>products</code> endpoints, and <code>ProductEdit</code>.</li>
        <li><strong>Add an admin page:</strong> add a component in <code>AdminApp.jsx</code>, an entry to <code>NAV</code>/<code>TITLES</code>, and a branch in the route dispatch (this docs section is a worked example).</li>
        <li><strong>Add an API endpoint:</strong> create a file under <code>functions/api/</code> (public) or <code>functions/api/admin/</code> (auto-authed); export the right <code>onRequest*</code> handler.</li>
        <li><strong>Change validation:</strong> edit <code>functions/lib/validation.mjs</code> once — both server and admin UI pick it up.</li>
        <li><strong>Reseed the catalogue:</strong> regenerate <code>d1/seed.sql</code> via <code>scripts/generate-d1-seed.mjs</code> (see the footgun below).</li>
      </ul>

      <h2>14. Known issues &amp; tech debt</h2>
      <ul className="admin-doc__list">
        <li><strong>Catalogue seed is destructive:</strong> <code>d1/seed.sql</code> deletes+reinserts products/skus; because <code>skus.id</code> is autoincrement, re-running it after real orders exist orphans <code>order_items</code>. Switch to an UPSERT on <code>(product_id, sku)</code> before heavy production use.</li>
        <li><strong>Dead dependencies:</strong> <code>bootstrap</code> is unused; <code>tailwindcss</code> is configured but produces no CSS for the live app. Removable.</li>
        <li><strong>Orphaned subtree:</strong> <code>src/components/views/*</code> (the old proposal deck) is not part of the shipped app.</li>
        <li><strong>Package name</strong> is still <code>salty-lamps-proposal</code>; harmless but worth renaming for production.</li>
      </ul>

      <p className="admin-doc__foot">
        This page is mirrored as Markdown at <code>docs/technical.md</code>; both render the same
        diagrams from <code>docs/diagrams/</code>.
      </p>
    </article>
  )
}
