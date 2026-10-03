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
