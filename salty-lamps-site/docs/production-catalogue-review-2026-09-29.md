# Production catalogue review — 29 September 2026

## Decision and account boundary

The owner confirmed `https://salty-lamps-proposal.pages.dev/` as the current
price and public catalogue reference. Its four public JSON endpoints were
captured with byte counts and SHA-256 hashes, and a fresh read on 29 September
matched the capture. Only these public responses and two publicly served image
files were used; no retired-account dashboard, database, credential or backup is
a migration source. The destination remains the empty D1 database in the
`Saltylamps@hotmail.com` Cloudflare account, as pinned in `wrangler.prod.toml`.
The production database still displayed zero tables and zero queries in the
signed-in owner dashboard. No remote import was attempted.

The 29 September Keychain provenance check found a saved account ID and token
metadata for `salty-lamps-proposal` tied to the retired
`asifhussain60@hotmail.com` account (`844bc687926c910d5ad9d79c40ad1f2f`).
The token values were not read or used. The currently authenticated Wrangler
identity is `asifhussain60@gmail.com`, but its separate personal account
(`19cb05067ea7e704f94481df1685ec51`) listed only `asif-academy` as a Pages
project. The approved owner dashboard listed only `salty-lamps-staging` and
`salty-lamps`. This contradicts the claim that the preview currently belongs to
the Gmail account; the saved metadata may be stale, but no accessible approved
account presently lists that project. Do not access the retired account to
settle provenance. Obtain a fresh authorised source export or move the source
through an owner-approved route before using non-public database fields.

## Completed review

| Check | Result |
| --- | --- |
| Public source | 34 visible products, 76 options, 10 categories, five collections and 186 published reviews. The product/category/content hashes matched on repeat fetch; the reviews endpoint was fetched twice with identical bytes. |
| Media | 77 distinct public image paths. The 75 static paths exist in the local site assets; the two dynamic gallery PNG files were fetched and SHA-256 checked. Their bytes still need owner-account storage before production serving. |
| Old database seed | Unsafe as an import source: 35 products, 77 options, 38 price differences among 60 exactly matched options, and 16 current public options absent by product/code/label identity. Its numeric option identities differ from the public source. Migration 010 fails its catalogue guard against this seed. |
| Fresh offline projection | `scripts/rehearse-public-catalogue.py` seeds the 76 public options using their stable IDs, applies all 16 current migrations including the guarded media migration, then restores the current public product fields, prices, stock and visible galleries. All 76 option read-backs, category metadata/aliases and 186 published review records match the source; foreign keys and migration ledger pass. The local report and database are in the ignored source-capture directory. |
| Postage | All 76 packed shipping weights remain unknown in the public response. The rehearsal deliberately leaves them null, so it cannot falsely claim saleable checkout parity. Net product weight is kept separately where public. |
| Content drift | The public response predates migration 012's collection targeting, Saltwood quote prompt, suppression of an unsupported review score, and expanded policy/returns pages. Those are newer replacement-site fixes, retained in the rehearsal. This is an explicit target-only change, not a silent import mismatch. |
| Historic business data | The 26 September Wix export remains a separate archive. It is not a fresh delta and is not merged into the shop or treated as current stock, orders or customer consent. |

The public API does not expose a product's underlying admin cover when an option
has its own image, nor the global ordering of images assigned to other options.
The rehearsal proves each *publicly visible option gallery*; the admin gallery's
complete ordering needs a direct, approved source read or owner review before
cutover. Hidden product records, operational settings, full review corpus,
promotions and packed weights are also outside the public capture.

## Production blockers

1. Obtain current packed shipping weights and opening stock by option, plus a
   fresh Wix business delta since 26 September. Compare additions, stock edits,
   discounts and orders; report conflicts without letting Wix override the
   owner-confirmed preview prices automatically.
2. Review hidden products, operational settings and full administrator image
   ordering. The previously approved bath-salt prices were for a local
   rehearsal; current copy, inventory and shipping remain open.
3. Provision owner-account image storage and scoped deployment credentials.
   The owner dashboard currently shows an R2 subscription/terms step with
   possible usage charges and an existing payment method. It has not been
   accepted. Public dynamic image URLs cannot be assumed to resolve on the
   owner production deployment.
4. Capture a recovery point and complete the production resource, account,
   access, schema, payment and email checks before any production import or
   shop/admin cutover. The old seed and test orders must not be copied.

The completed offline projection is intentionally **not import ready**. Writing
it into production would turn all 76 options into missing-postage items and
could change administrator gallery order. That would create the regression the
owner explicitly asked us to avoid. The existing public holding page, Wix
service and Zoho mail remain in place.
