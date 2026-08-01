# Prompt for the next session

Copy everything below the line into a new Claude Code session started in
`~/PROJECTS/SaltyLamps`.

---

Continue the Salty Lamps data-driven rebuild. Work is on the branch
`feature/data-driven-catalog`, six commits ahead of `main`, working tree clean.
Read `~/.claude/plans/run-a-full-analysis-recursive-rain.md` first — it is the
approved nine-stage plan with the full audit findings, and stages 0 through 6 plus
the catalogue repricing are done.

## Where things stand

The backend was already data-driven. The storefront was not: roughly a thousand
lines of hardcoded product, category and marketing content. Stages 0-6 moved the
category taxonomy, product galleries, stock depth and settings into the database
and rewired the shop and admin to them. A category created in the admin now gets a
working page with no code change — that was verified end to end.

The catalogue was also repriced. Fifty-six of seventy-seven items carried the same
price as every other size of themselves; twenty-one were selling below cost. The
margin rule was **derived, not chosen**: eighteen already-correct products all sat
at exactly twice trade cost rounded up to the next whole pound less a penny, which
is keystone markup. `scripts/reprice-from-trade-list.mjs` applies it, is idempotent,
and writes through the admin API so every change is audited.

## Do these in order

**1. Deploy to the test site.** This is the priority — the owner needs to click
through real prices before more is built on top.

Before deploying, two things must be fixed:

- The remote database is missing the `product_images` table entirely; migration 002
  was never applied there. Apply `d1/migrations/002-product-gallery.sql` and
  `d1/migrations/003-categories-and-settings.sql` to the remote database. Both are
  idempotent. Back up first — `scripts/uat-refresh.sh` shows the export pattern, and
  there is already a pre-work backup at `d1/backups/pre-datadriven-20260801-090051.sql`.
- Confirm the `DEV_ADMIN_BYPASS` Pages secret is gone. Asif was asked to remove it
  and redeploy; verify with `npx wrangler pages secret list --project-name
  salty-lamps-proposal`. If it is still there, stop and tell him — an anonymous
  request to `/api/admin/products` on the deployed site currently returns the whole
  catalogue, and the same door is open on delete and refund.

Note that the repricing was applied to the **local** database only. The remote one
still has the old flat prices. Decide with Asif whether to reprice remote too or
wait for the owner's returned spreadsheet, since a fresh inventory is planned.

**2. The owner's catalogue spreadsheet.** Already built and waiting in
`salty-lamps-site/handover/`. Asif is sending it to Asim (the owner) via WhatsApp —
the message is in `handover/whatsapp-to-asim.txt`.

- `scripts/build_owner_workbook.py` regenerates it from the live catalogue.
- `scripts/import_owner_workbook.py` reads the completed file back, validates it and
  writes through the admin API. Round-trip tested. It refuses to write while any
  product code is shared by two products, which is deliberate — that defect is what
  the exercise exists to fix.
- When the file comes back, run the importer in report mode first, show Asif the
  diff, then apply.

**3. The marketing content layer** — stage 7 of the plan, the largest remaining
piece. Collections, merchandising sections, per-theme selling copy, the process
page, the policy pages, the reviews, and the site name/address. Three parallel
design passes fed into the plan's stage 7; the important decisions already made:

- One self-referencing `collection_sections` table for sections and their subgroup
  bands, not two tables — a band is a section with a label and no chrome.
- Section membership rules become a JSON column
  `{categories:{any,all,none}, tags:{any,all,none}}` evaluated by a new pure module,
  replacing today's JavaScript predicates.
- **The extraction script must prove the translation**: for every product against
  every section, assert the new rule matches the old predicate exactly, and abort on
  any mismatch. This is the single most important safeguard in that stage.
- Rich text stores as JSON blocks and spans, not markdown. Prerendered pages are
  head-only — verified, the body is just `<div id="root"></div>` — so no HTML
  serialiser is needed, which removes the escaping-parity risk entirely.
- `data/customer-reviews.json` has only six entries: adopt its schema, keep the
  195-row corpus from `src/data/reviews.json`, and move the medical-claim filter to
  write time as a stored flag.

## Things that will bite you

- **Two local databases.** `wrangler pages dev` binds
  `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/3901a98…sqlite`; the other file
  has 481 demo orders and the server never reads it. `wrangler d1 execute --local`
  hits the wrong one. This already produced a snapshot full of stale prices that
  looked entirely plausible. Always verify through the running server.
- **Never regenerate `d1/seed.sql`.** Its source CSV was never committed and it does
  `DELETE FROM skus`, which orphans order history. New data arrives as additive
  migration SQL or through the admin API.
- **Never JOIN `product_images` into `PRODUCTS_QUERY`.** It already fans out per SKU,
  so joining images multiplies routes and sitemap entries. There is a separate query
  and a JS stitch, with the reasoning recorded next to it.
- **Never emit `<route>/index.html` or add per-route `.html` rewrites to
  `public/_redirects`.** Cloudflare Pages 308-loops; commit `b954e79` fixed exactly
  that once.
- Local dev needs two servers: `npm run build && npx wrangler pages dev dist --port
  8788 --d1 DB=salty-lamps-db --r2 IMAGES=salty-lamps-images`, plus `npm run dev`.
  Vite on 5173 serves live source and proxies the API to 8788; 8788 serves the built
  bundle, so editing source and checking 8788 shows stale UI.
- Running two wrangler instances at once locks the local database and kills both.

## Still open, needs Asif or the owner

- VAT and postage: the shop charges no delivery and shows no VAT, while the trade
  list says VAT is added at 20%. Both are on the spreadsheet's VAT & Delivery tab.
- Product tags are empty for all 35 products, so the tag-driven merchandising
  sub-groups stay dormant. The code that reads them is fixed and waiting; the data
  is a content decision.
- Thirteen items could not be priced from the 2025 list — bath salts, cables, the
  dolphin lamp, the bundles, and the codes shared between products. All are on the
  spreadsheet.

## House style

Asif's response format is in `~/.claude/response-template.md` and is strict: plain
English in chat, no file paths or internal identifiers, H2 title, H3 sections,
blockquote callouts, tables for tabular data, and a `### Next: 👤 Asif` block with
alphabetised options and a recommendation. Times in Eastern, 12-hour.
