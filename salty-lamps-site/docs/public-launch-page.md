# Temporary public launch page

The public marketing page says "Going live shortly", previews lamps, saltware and
Saltwood Frames, and invites visitors to bookmark the site. Its button explains
browser bookmark shortcuts; it does not collect emails or promise a launch date.

## Hosting boundary

Code is deployed through `deploy-live.sh` only, with a dated private SQL export
and Time Travel bookmark. No catalogue, customer, order or stock writes are needed.

The www URL rewrite `Public launch page while shop stays private` matches GET/HEAD
outside the approved preview IP, except /api/, ACME and the exact launch assets.
It rewrites to `/going-live` without changing the visitor's address bar.
Middleware serves the static page with 503, Retry-After and no-store.

The existing active www holding Block rule continues to deny commerce/API access
and all writes. Its only added exceptions are GET/HEAD for `/going-live`,
`/going-live.html` and the seven exact files in `/launch-assets/` (CSS, script,
logo and four photos). The original webhook and ACME exceptions remain.
The URL rewrite runs before custom security rules. Static files disclose no
shop data. The test/admin Access policy and reserve holding project are unchanged.

## Full launch and rollback

Full commerce launch still requires the documented owner acceptance, provider
tests and Asif's explicit public-launch approval. Disable the URL rewrite AND
lift the holding Block rule together, then verify signed-out access from another
network. Removing only one intentionally leaves the shop closed to the public.
Public bookmarks keep their original www address and open the shop after launch.

To retreat to this page, restore both rules. To retreat before page publication,
restore the original holding Block expression; do not deploy a sandbox release
over the real shop. Retain the separate owner holding project for rollback.

## Verification

Unit tests exercise GET, HEAD and rejected write methods on the holding page.
Review desktop and phone layouts and the bookmark instructions. After publishing,
check public home/deep links show the launch page, exact images/styles/scripts
load, API remains denied outside the approved IP, and approved private shop still
loads. Use read-only checks only against the owner's real database.

## Published evidence - 3 October 2026

- Release commit: `663c9ebbd296b7a4d095ebfb4e5bca9467da720e`.
- Live deployment: `https://e6829ad9.salty-lamps-staging.pages.dev`.
- All 256 unit tests and production build passed in the guarded release.
- Recovery export: `~/salty-lamps-private/live-20261003T144533Z/live-before.sql`,
  15,874,257 bytes, SHA256
  `e561c20663511dfb242340fe4238ad7ac1344c2bbccdb700ad835b867b257a94`.
  The private Time Travel bookmark is beside it.
- URL rewrite: `0c83c9d27cc14f1fae0788035979bc94`, active, static `/going-live`.
- Holding Block rule: `17a7e3ab521d40bfa2a752022584612c`, remains active; exact
  GET/HEAD static launch exceptions only, approved preview IP unchanged.
- Cloudflare Trace public GET home matched the rewrite and reached 503. POST
  `/going-live` skipped the rewrite, matched holding Block and ended 403.
- Outside network read through Jina's public URL reader returned the actual launch
  page at www root with 503, and /api/products returned Cloudflare Block with 403.
  The web research fetcher itself is blocked and was not used as evidence of failure.
- Chrome live preview `/going-live`: all five images loaded, desktop and 390px
  phone had no overflow; bookmark dialog opens/closes. Approved private gallery
  still renders the shop rather than the holding page.
- Public preview for an approved-IP viewer: `https://www.saltylamps.co.uk/going-live`.
- Test/admin Access policies and the reserve holding Pages project were untouched.
