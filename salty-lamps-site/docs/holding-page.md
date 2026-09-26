# Public holding page

## Current deployment and authorization

On 26 September 2026 Asif explicitly changed the original replacement-only instruction and requested the construction page on **www.saltylamps.co.uk**. Published in the approved Saltylamps@hotmail.com account, account ID `e35d5918c507bc2cf4e920fe38b5e318`, Pages project `salty-lamps`.

Current public URL: https://www.saltylamps.co.uk/. The bare https://saltylamps.co.uk/ retains its Wix A records and redirects to www. Cloudflare Pages shows the www custom domain **Active, SSL enabled**. Wix service and Zoho mail are retained. This authorization covers the holding page only, not the replacement commerce application.

## Published scope

The standalone `holding-site/` directory contains seven files: HTML, CSS, logo, wooden-frame photograph, robots file, response-header rules and a holding-only worker. No shop/admin application, customer exports, database bindings, credentials or commerce handlers were uploaded.

The worker returns temporary-unavailable (503) with Retry-After for page, admin and API paths and for non-read methods, without forwarding requests to commerce or Wix. Three explicit image/style assets remain readable. Preview indexing is disabled; public crawlers can read the temporary-unavailable response. This behavior passed three local tests. Command-line public HTTP probes were denied with 403, so deployed status/header parity was not independently established by those probes; do not count them as passed. Browser rendering was verified directly.

Contact buttons point directly to mailto:info@saltylamps.co.uk. Live verification discovered Cloudflare email obfuscation conflicted with the script-free policy. Scoped email_off HTML comments fixed those three public links without changing zone-wide security settings. Reference: https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/.

## Verification

- Cloudflare dashboard confirmed seven files successfully uploaded and deployed.
- Owner-account DNS table shows www CNAME salty-lamps.pages.dev, Proxied, Auto TTL.
- Desktop Chrome and the in-app browser show the revised public holding page and wooden-frame image.
- At 390 pixels wide, images load and there is no horizontal overflow. Desktop image loading and overflow checks also passed. An initial Chrome viewport override did not resize that tab; the actual 390-pixel result was verified in the in-app browser.
- All three contact links resolve directly to the public business mail address in the rendered page. No email was sent.
- Bare-domain navigation redirects to the www holding page. Direct /admin displays only the holding content. This is not administrator authentication: no admin application is deployed, and Access remains unconfigured.
- Thirty-six comparisons across both authoritative servers and two public resolvers preserve apex and mail-related records. See `infra/holding-dns-before-2026-09-26.json` and `infra/holding-dns-after-2026-09-26.json`. This proves routing preservation, not delivered mail.

## Rollback

Current package: `outputs/salty-lamps-holding-public-contact.zip`. Earlier packages are retained as provenance; `salty-lamps-holding.zip` contains the superseded link to the old public shop and must not be used on the customer domain because it would loop.

For a defective holding revision, re-upload the last verified public holding bundle to the same owner project. For an owner-authorized return to Wix, restore only www as CNAME cdn3.wixdns.net, **DNS only**, Auto TTL. Verify actual Wix content from both www and the bare address, then review/removal of the obsolete Pages custom-domain attachment. Preserve all apex, MX, verification and email authentication records. No Wix service is cancelled. Original record snapshot remains in `infra/dns-source-2026-09-26.zone`.

Rollback triggers: public page or photo unavailable, contact route broken, unexpected application/customer exposure, or unintended mail-record change. Timed full-shop rollback and final commerce reconciliation are still pending. Normal browser domain activation was observed; this is not a full shop restore rehearsal.

## Continuing migration

Keep building and rehearsing the real shop locally. Do not upload it to this public project until the migration launch gates pass and the owner authorizes that release. The guarded full-shop deployment remains in place; the empty EU customer database is untouched. Remote full-shop review requires the separately reviewed access controls first.

The page uses existing cream/amber styling, logo and wooden-frame media. Style-catalog references were adapted locally; no deployable file references the theme archive.
