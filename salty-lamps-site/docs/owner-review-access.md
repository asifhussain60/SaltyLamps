# Owner review access — 3 October 2026

Asif requested that every welcome/checklist destination work for Asim's
Cloudflare account, requested a visible administrator sign-out control, and
required simulated-owner and hosted link checks before an owner handoff.

## Cause and bounded correction

The live administrator and checklist were generating www links after cutover.
The www hostname remains intentionally restricted to Asif's network connection;
Cloudflare account membership does not bypass that rule. The existing test
hostname serves the same live deployment, owner-edited database and provider
configuration as www, behind the administrator application's existing policy.
This is a private review address, not an isolated sandbox.

Administrator View store, launch-checklist destinations and Asim Test Suite
shortcuts now use that existing private hostname. Administrator routes stay on
admin. Public URLs, canonical tags, email URLs, www holding rules, data and
provider configuration are unchanged. Checkout's existing return URL derives
from the initiating request origin, so a checkout started on test returns there.
Real payment/refund authorization remains separate.

The header now provides Sign out on every admin page, using Cloudflare's
documented `/cdn-cgi/access/logout` endpoint and the existing unsaved-change
guard. Access logout revokes that user's Access sessions across applications;
it does not sign out the separate Cloudflare account dashboard.

Cloudflare application `c13f24a5-4b11-4bcf-9b88-4d34bfab15ee` covers the entire
admin and test hostnames. The saved change disables instant identity-provider
redirection so the Cloudflare choice is visible. The sole Cloudflare provider,
one-hour session, approved owner/operator policy and hostnames are unchanged.
The policy tester evaluated saltylamps@hotmail.com and
asifhussain60@gmail.com as allowed using their recorded identities.

## Verification boundaries

`test/owner-review-access.test.mjs` exercises every administrator navigation
destination and launch-checklist destination. A locally signed fixture with
Asim's email passes through the real origin token verifier via both cookie and
assertion header. Expired tokens, altered signatures, incorrect issuer/audience,
and absent tokens fail closed. The fixture uses an isolated mocked key service;
it is not a Cloudflare-issued credential and is never sent to a live host.
Cloudflare policy testing and actual hosted browsing are separate evidence.

First release: commit `5102e97`, deployment `4bd2e7a1.salty-lamps-staging.pages.dev`.
Backup and bookmark are in the private `live-20261003T152155Z` export directory.
Sixteen administrator destinations and nine shop destinations rendered in the
approved operator browser session. All 20 original navigation/checklist URLs
redirected signed-out GET requests to the expected Access application.
The published Sign out button displayed successful logout; choosing Cloudflare
returned to the administrator dashboard. This verifies the operator round trip,
not Asim's remote browser or an actual owner-issued token.

Follow-up adds underlined links within the authored welcome/checklist instructions,
including exact product pages, policies, manufacturing, customer reviews and the
inventory weights tab. Links open separately, preserving the checklist. Stored
answers, comments and review identifiers are unchanged. Local desktop and 390px
phone layouts were checked with a read-only empty-review fixture; no horizontal
overflow. Targeted review and simulated-token tests passed (9 tests).
Hosted follow-up verification is pending this code-only publication.

## Public-opening follow-up

Retire `ownerReviewHref` and restore the normal production `storeHref` calls
before removing the test hostname. This is separate from public opening, which
still requires explicit owner acceptance and Asif's approval.
