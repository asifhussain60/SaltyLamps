# Salty Lamps Cloudflare removal record — 30 October 2026

## Outcome and scope

Asif authorized removal of the replacement shop from the approved Salty Lamps
owner Cloudflare account, including the development and holding sites, the
administrator portal, hosted code, videos and shop storage. This record documents
completed removal, not a deployment or a plan to republish. Older launch and
infrastructure documents describe historical environments and must not be treated
as evidence that those environments still exist.

Wix was never accessed or changed during this work. No Cloudflare account settings,
memberships, permissions, billing subscriptions, email configuration, DNS records,
or main website routing were changed. The administrator and test custom-domain
attachments were removed from the deleted Pages projects; this was project cleanup,
not a DNS or account-setting change. No Stripe or Resend changes were made.

## Removed resources

| Resource type | Removed resources | Details |
| --- | --- | --- |
| Pages projects | `salty-lamps-staging`, `salty-lamps-development`, `salty-lamps` | Former live shop, development shop and holding site; project deletion removed their hosted code, deployment history, bundled videos and administrator-portal implementation. The former live project had 30 deployments before deletion. |
| Project domain attachments | `admin.saltylamps.co.uk`, `test.saltylamps.co.uk` | Detached before deleting the associated projects. DNS records and Access policies were not changed. |
| D1 databases | `salty-lamps-staging-db`, `salty-lamps-development-db`, `salty-lamps-db` | All three exported privately before deletion; every export restored successfully with SQLite integrity checks passing. The reserve database contained no application tables. |
| R2 storage buckets | `salty-lamps-images`, `salty-lamps-development-images` | All objects preserved and verified before deletion: 27 live objects and 14 development objects, 41 files total. |

## Final provider checks

Read-only checks of the approved owner account after deletion returned:

| Service | Observed result |
| --- | --- |
| Pages projects | Empty list |
| Worker application scripts | Empty list |
| D1 databases | Empty list |
| R2 buckets | Empty list |
| Workers KV namespaces | Empty list |
| Former Pages addresses | All three project addresses failed DNS resolution after deletion. |
| Separate Cloudflare Images storage | Dashboard reported image storage not applicable under the current plan. |
| Separate Cloudflare Stream video service | The signed-in dashboard API explicitly returned `Cloudflare Stream not enabled` (provider code `10002`). No separate Stream videos were downloaded or deleted. |

The initial Stream requests using the command-line login returned a generic
authorization failure, and the video dashboard rendered blank. The later signed-in
dashboard API response supplied the specific service-not-enabled message. This is
a service-status confirmation, not a successful empty video-list response. No plan
was activated, credentials created, or permissions changed to obtain it.

Checks apply to the approved owner account at removal time. They do not cover the
retired, prohibited proposal account, other personal accounts, Wix, third-party
caches, or Cloudflare's internal retention systems. Access policies and other
account configuration remain in place; they are not hosted application code.

## Latest source and all branches preserved

The live and development deployments both identified source commit
`9200ca5a4a86d49e86fe293ed6a0f60bc301e43a`. GitHub main and develop were four commits
behind it. The deployed commit was recovered from the verified local Git bundle,
checked out on local branch `recovered-live`, and compared with all five GitHub
branches: `main`, `develop`, `golive`, `claude/charming-mccarthy-halv8j`, and
`codex/salty-image-upload`. Every branch was an ancestor of the recovered version;
none contained unique changes absent from it.

The recovered source was pushed to GitHub main without force. GitHub's commit and
source-tree identifiers were checked against the local repository, and the stored
file identifiers for all nine videos matched. This documentation is a subsequent
commit; the recovered application-code commit above remains its ancestor.

Repository: https://github.com/asifhussain60/SaltyLamps

## Nine videos retained in the repository and GitHub

All nine original video files are tracked in Git, total 69,274,709 bytes, and are
present in both the local repository and GitHub main:

- `salty-lamps-site/public/media/platter-in-box.mp4`
- `salty-lamps-site/public/media/video/I_want_to_create_a_short_endin.mp4`
- `salty-lamps-site/public/media/video/collection/home-gifts-hero-16x9.mp4`
- `salty-lamps-site/public/media/video/collection/horses-farm-hero-16x9.mp4`
- `salty-lamps-site/public/media/video/collection/kitchen-food-hero-16x9.mp4`
- `salty-lamps-site/public/media/video/collection/saltwood-frames-hero-16x9.mp4`
- `salty-lamps-site/public/media/video/collection/trade-spa-hero-16x9.mp4`
- `salty-lamps-site/public/media/video/salty-lamps-homepage-hero-16x9.mp4`
- `salty-lamps-site/public/media/video/salty-lamps-manufacturing-process-16x9.mp4`

## Private local recovery locations

These are paths on Asif's Mac, not GitHub downloads. The private recovery data is
outside the repository and has not been committed or pushed. GitHub preserves
source and the nine tracked videos; it does not contain the private database
exports, customer records, or the fresh 41-object storage backup.

| Location | Preserved contents and checks |
| --- | --- |
| `/Users/asifhussain/salty-lamps-private/cloudflare-removal-20261030/` | Fresh removal-time database exports, 41 storage objects and their metadata/checksums, all-branches Git bundle, before/after inventories, deletion receipt and separate Stream verification response. |
| Same folder: `recovery/salty-lamps-staging-db.sql` | Fresh former-live database export; restored successfully, 40 tables, integrity check passed. |
| Same folder: `recovery/salty-lamps-development-db.sql` | Fresh development database export; restored successfully, 40 tables, integrity check passed. |
| Same folder: `recovery/salty-lamps-db.sql` | Fresh empty reserve database export; restored successfully, no application tables. |
| Same folder: `recovery/database-verification.json` | Export checksums and local restore/integrity results. |
| Same folder: `recovery/images-manifest.json` | Maps all 41 original object keys to local backup filenames, sizes and SHA-256 checksums. Individual backup objects are beside it. |
| Same folder: `all-preserved-branches.bundle` | Verified complete Git bundle containing local and remote branches, including the recovered deployed commit. |
| Same folder: `removal-receipt.json` | Successful deletion record for all three projects, both buckets and all three databases. |
| Same folder: `stream-verification.json` | Exact non-secret provider response stating Cloudflare Stream is not enabled. |
| `/Users/asifhussain/salty-lamps-private/live-snapshot-20261010T111924Z/` | Earlier verified recovery snapshot: database export, deployed/current source archives, Git bundle, hosting metadata and 27 uploaded images. All 45 manifest-listed files matched their checksums; database restore integrity passed; each source archive contained the nine videos. |
| `/Users/asifhussain/Documents/Codex/2026-10-30/clon/SaltyLamps/` | Working repository with recovered latest application code and nine tracked videos, plus this record. |

The private removal-time folder also contains the non-secret provider inventories
saved before and after removal. These records and local recovery copies do not
restore hosting automatically. Any future republication requires a separate,
explicit instruction and a fresh review of historical deployment configuration.
