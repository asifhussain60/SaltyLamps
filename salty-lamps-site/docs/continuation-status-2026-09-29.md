# Continuation status — 29 September 2026

What was verified, where, and what is still open after the second working
session on the draft pull request. Nothing here is deployed, and the migration
is **not** complete. Test counts are from a Linux cloud container using
Playwright's Chromium 141, not the owner's Chrome on the Mac.

## Locally verified in this container

| Check | Result |
| --- | --- |
| JavaScript unit tests | 167 of 167 pass (166 previously, plus one new regression test). |
| Python tests | 26 of 26 pass once `openpyxl` is installed; without it `test_weight_import` fails to import, which is an environment gap, not a code fault. |
| Production build | Passes with `CONTENT_SNAPSHOT_SOURCE=committed`; 112 route shells, all referenced media present, committed snapshot unchanged. |
| Real local D1, test-shop shape | With no R2 binding and the sandbox flags of `wrangler.staging.toml`: a 2,091,038-byte PNG uploads, replays idempotently, is served byte-identical (SHA-256), answers HEAD and conditional requests, reorders (cover follows the first photo), rejects a stale order with 409, deletes, and leaves no rows behind. 15 of 15 checks. |
| Price correction | The generated SQL, applied unedited to a real local D1 bootstrapped like the test shop, moved all 43 prices to the reviewed values. Culinary salt went from 2.80 to 3.99, 11.99 and 16.99 for 1, 5 and 10 Kg, fine and coarse. |
| Release script | `deploy-staging.sh` offline half passes on a clean commit. It stops on the wrong account variable, on a dirty tree and when not logged in. Its identity check was exercised with synthetic login data: the owner and the Gmail administrator inside the owner account pass; the retired identity, a login that can reach the retired account, and a login that is not in the owner account are refused. |

## Browser suite: not reproduced

The earlier report of 270 passes and 26 planned skips was **not** reproduced.
On a fresh disposable fixture the run gave 234 passed, 9 failed, 1 flaky (passed
on retry), 26 skipped and 26 that did not run (not investigated).

- **Four failures are video playback** (manufacturing film and Saltwood Frames
  film, desktop and mobile). Both files are H.264 (`avc1`), and this Chromium
  answers `canPlayType` with an empty string for it. A codec gap in the
  container browser, not a site fault.
- **Five failures and the flaky test are scroll-position specs** ("starts at the
  top", "never shows the old shop scroll position"). The same specs fail on the
  base commit of the pull request in this container, so this work did not
  introduce them. A manual probe showed `window.scrollTo` returning 0
  immediately under `html { scroll-behavior: smooth }` and 4000 with reduced
  motion emulated, but a full rerun with reduced motion in a scratch
  configuration gave the same counts, so the cause is **unresolved**.
- A targeted run of the admin, audit-repair and admin-host specs, leaving out
  the scroll case, gave 82 passed, 18 skipped, 0 failed. That includes the
  gallery reorder and lost-response upload specs on desktop and mobile.

## Defect found and fixed

The sandbox image store wrote each photo chunk as a BLOB. The D1 binding
marshals a BLOB as one JavaScript number per byte. In V8, turning a photo
into a number array and serializing it took about 25 ms for 300 KiB and 175 ms
for 2 MB, against the 10 ms Worker CPU allowance of the Free plan; the array
step alone took about 115 ms at 2 MB. It passed every local test, so it could
have surfaced only on the deployed test shop. Chunks are now base64 text (about
4.5 ms for 2 MB); older BLOB chunks still read. Local wall-clock for the 2 MB
upload fell from about 380-420 ms to 86 ms and the serve from about 165-195 ms
to 41 ms. These are indicative only: they are V8 and local timings, not
Cloudflare's CPU accounting, which can be confirmed only on the deployed site.

## Remotely verified

**Nothing.** Outbound requests from this container are refused by the
environment's network policy (HTTP 403 from the egress proxy), including
`salty-lamps-proposal.pages.dev`, `test.saltylamps.co.uk`,
`www.saltylamps.co.uk`, `dash.cloudflare.com` and `api.cloudflare.com`. Nothing
was read from or written to Cloudflare, the test shop or the preview. The
handoff states that none of these changes has reached the test shop, and this
session could not check it.

## Blocked

- **Full export.** The only store holding hidden products, complete admin
  gallery order, settings and packed weights is the proposal database. The
  saved metadata places it in the retired account, which project rules forbid
  using. The approved Gmail personal account lists no proposal project and the
  owner account lists only `salty-lamps-staging` and `salty-lamps`. A read-only
  search of the approved Gmail and Drive found no database export, weights or
  stock file, and no returned owner workbook. The public capture (34 products,
  76 options, 10 categories, five collections, 186 published reviews, 77 image
  references) remains a public-only reference, not a full export.
- **Fresh public recapture and offline rehearsal.** Needs network access to the
  preview, and the ignored capture folder is on the owner's Mac, not here.
- **Packed weights, actual stock, fresh Wix delta.** No source reachable. The
  Gmail check found no Wix catalogue-change notice; the only recent Wix mail is
  an app auto-renewal cancellation on 29 September.
- **Production image storage.** R2 still needs the subscription and terms
  decision at the moment of action. It was not accepted and no charge was
  incurred.

## Still required before any production write

1. An authorised full source. Rules forbid the retired account, so this needs an
   explicit owner decision on a new route, for example owner-entered hidden
   products, weights, stock and settings in the private shop's admin using the
   returned workbook path, followed by a fresh export from the owner account.
2. Publish this release to the private test shop with `deploy-staging.sh`, then
   run its Chrome checklist in the protected admin and shop.
3. Recapture the public preview with `scripts/capture-public-preview.py`, rerun
   `scripts/rehearse-public-catalogue.py`, and reconcile three ways against the
   fresh Wix delta and the newer replacement-site fixes.
4. Recovery point, reviewed mapping, complete image storage, packed weights,
   actual stock and the documented release gates.
5. The separate launch decision. The holding page, Wix shop and Zoho mail stay
   as they are.
