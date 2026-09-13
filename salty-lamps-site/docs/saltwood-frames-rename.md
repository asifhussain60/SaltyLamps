# Saltwood Frames correction — 2026-09-06

Published to https://salty-lamps-proposal.pages.dev/collection/saltwood-frames.
Deployment: `e0562e7f`. Previous deployment: `54096e57`.

Corrects the 2026-09-05 Wooden Frame Collection rename. Active collection copy,
source fallbacks, search metadata and seven media filenames use Saltwood Frames.
Both Aura Collection and Wooden Frame Collection addresses redirect directly to
new addresses. Historical migrations remain intact; migration 008 follows 007.
Admin products/categories already had the correct owner-supplied name, and retain
their IDs, visibility, prices and stock. The collection still has no visible products.

Only closing scene 06 was regenerated, with synchronized speech:
“Saltwood Frames. Nature. Simplicity. Discover yours.”
The first five scene clips are preserved. The rebuilt film is 45 seconds long,
with fast-start MP4 metadata and a regenerated poster. Render backups stay outside
public assets. The manufacturing video was not changed by this correction.

## Verification

- Build and all 31 unit tests passed.
- Six local and six published collection/admin/redirect checks passed on desktop/mobile.
- Published film SHA-256 matches the rebuilt file; live database rows exactly match
  the rehearsed transformation, with valid foreign keys and repeat-safe migration.
- Broader published suite: 66 passed, four failed. All four failures were reproduced
  against yesterday’s immutable deployment: manufacturing-film seeking and missing
  Product structured data, each on desktop/mobile. They predate this correction.
- Visual browser review covered collection page, mobile layout and admin product row.

Detailed render, database backup, checks and rollback evidence remain in the ignored
`.saltwood-render-cache/verification.json` and neighboring files. No full catalogue
reseed or product visibility change was performed.
