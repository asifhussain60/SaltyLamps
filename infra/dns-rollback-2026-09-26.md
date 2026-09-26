# DNS-only move and rollback

Owner explicitly approved moving DNS to Cloudflare while retaining Wix website hosting and Zoho email, with rollback required. Registration remains at 123 Reg. No mailbox migration, shop deployment, cancellation or paid upgrade is authorized by this step.

## Baseline and evidence

- Original nameservers: `ns4.wixdns.net`, `ns5.wixdns.net`.
- Target nameservers: `james.ns.cloudflare.com`, `tani.ns.cloudflare.com`.
- Full visible source zone: `dns-source-2026-09-26.zone` (14 service records; old NS included for reference only).
- Preflight: `dns-preflight-2026-09-26.json`. All 40 queries across two Wix and two Cloudflare nameservers matched all ten service RRsets, comprising 14 records. Both public HTTPS addresses returned 200 with the expected Wix destination. Nominet reports unsigned delegation; registrar DS tab contains no records.
- Cloudflare service records are DNS-only. Zoho MX priorities remain 10/20/50. Wix source records and services remain intact.

## Change and validation

Replace only the two nameservers in 123 Reg with the assigned Cloudflare pair. Verify the saved registrar state, Nominet delegation, Cloudflare activation, both authoritative servers, public DNS and both HTTPS addresses. Record propagation separately from completion. Do not claim tested email sending/receipt based only on DNS checks.

## Rollback triggers and procedure

If Cloudflare fails to answer the preserved service records correctly, public DNS returns a newly introduced failure, the Wix site develops a DNS/TLS/availability failure attributable to the change, or mail routing no longer returns the original Zoho destinations, stop further changes. Distinguish expected cached Wix nameservers from a fault; both providers must serve the same service records throughout propagation.

In 123 Reg, open saltylamps.co.uk > DNS > Nameservers > Change Nameservers, choose custom nameservers, restore exactly `ns4.wixdns.net` and `ns5.wixdns.net`, and save. Verify the registrar read-back and Nominet delegation, query both Wix servers against the saved baseline, then verify HTTPS and Zoho MX records through public resolvers. Keep the matching Cloudflare zone intact during cache expiry; deleting it can break clients still using cached Cloudflare delegation.

Rollback is not instantaneous: recursive resolvers may retain the previous delegation until cache expiry. Keeping both zones identical reduces that exposure. No DNSSEC changes are needed for this unsigned baseline; do not add a DS record during this move. If the fault is a single Cloudflare record, restore that exact baseline value as well so cached Cloudflare clients recover.

## Status

Preflight passed. Nameserver save was attempted once and rejected by 123 Reg. Registrar read-back and Nominet still show ns4.wixdns.net and ns5.wixdns.net. Nominet lists client update prohibited, and the registrar Overview shows Domain Lock On. No lock change has been made. Temporary unlocking requires action-time owner approval under the computer-use security policy. If approved, verify unlock, retry the exact two Cloudflare nameservers, and restore the domain lock after the change (or after rollback). No rollback was needed for the failed submission.

## Successful submission and restored protection

Owner subsequently approved the temporary unlock. The first unlock dialog encountered a transient registrar error; refreshing allowed the approved unlock. Nameserver change then succeeded. Registrar read-back and Nominet verify james.ns.cloudflare.com and tani.ns.cloudflare.com. Domain Lock was restored and confirmed both in the registrar UI and Nominet restrictions. `dns-postflight-2026-09-26.json` records all 40 matching source/destination checks, both HTTPS addresses returning 200, unchanged Zoho MX destinations, and public resolver caches still serving the original Wix delegation. Cloudflare remains in propagation verification. No rollback trigger was observed, and no mailbox or website-hosting change was made. Any rollback now begins with temporarily unlocking, then restoring the original Wix pair and relocking after registry confirmation.

Follow-up: Cloudflare and Google public resolvers (1.1.1.1 and 8.8.8.8) now both return the Cloudflare nameserver pair. Both return the original Zoho MX priorities, both HTTPS addresses return 200, and Nominet confirms domain restrictions restored. This confirms propagation at these two resolvers, not every global cache.

Activation follow-up: Cloudflare dashboard confirms activation. Cloudflare and Google public resolvers both return james.ns.cloudflare.com and tani.ns.cloudflare.com, unchanged Zoho MX, and both public website addresses return 200. Domain restrictions remain restored. Global cache convergence and mailbox send/receive are not independently claimed.

Continuation readiness check: `dns-continuation-2026-09-26.json` records 46 passing comparisons: the ten original service RRsets on both Wix and both Cloudflare authoritative servers, plus delegation, Zoho MX and Wix www routing on both public resolvers. Both public HTTPS addresses returned 200. This verifies that the saved old web targets still resolve and both authoritative providers retain matching service records. It is a read-only rollback prerequisite, not an executed or timed rollback rehearsal, proof of current registrar permissions, or a mailbox send/receive test. No nameserver or record change occurred.

## Later authorized holding-only website switch

Asif subsequently explicitly requested the holding page on www.saltylamps.co.uk. Only its CNAME changed: cdn3.wixdns.net (DNS only, Auto) to salty-lamps.pages.dev (Proxied, Auto), in the approved owner account. Pages reports Active with SSL enabled. The apex Wix A records continue redirecting to www; Zoho and the mail-related aliases are unchanged across 36 authoritative/public-resolver checks.

The original DNS-only evidence above is historical and must not be read as claiming that www still points to Wix. Restore the exact previous www CNAME with DNS-only status for an authorized Wix rollback; verify both public addresses, then review the Pages attachment. Do not change nameservers or mail records for a website-only rollback. Holding release evidence and bundle locations are in salty-lamps-site/docs/holding-page.md.
