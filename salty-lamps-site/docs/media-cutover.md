# Reviewed media cutover gate

This is a required part of Phase 8 and Phase 15 of the Wix-to-owner-account migration. Publishing the review site does not migrate the customer's domain or the owner's database.

## What must travel together

| Release component | Source | Destination / acceptance |
|---|---|---|
| All 100 approved lighter images | `public/media/light-catalogue/` | Same paths on the owner's Pages deployment; every SHA-256 matches `data/media-refresh.json` |
| All other generated media, including the Saltwood Frames film and repaired manufacturing film | Entire `public/media/` tree | Preserve the complete tree in `dist/media/`; never publish only the 100-image subfolder or only the JavaScript bundle |
| Original references and recovery material | Original media files, `public/media/original-uploaded/`, source/output checksums and prompts | Preserve originals in the release archive; do not delete the previous deployment or source bucket during cutover |
| Per-option image ownership | Migration 009, then migration 010 after the final catalogue import | All 73 reviewed options resolve to their assigned image; owner database identities can differ |
| Collection images, backgrounds, posters, category and theme media | Replacement list in `data/media-refresh-assignments.json` and migration 010 | All 73 formerly active raster references point to reviewed replacements; no dependency on the review deployment |
| Build and fallback content | `src/content/media-map.mjs`, `src/content/content-snapshot.json`, current application code | Same reviewed release; build from the committed snapshot and then refresh it from the owner's verified database |
| Remaining owner-uploaded photographs | Full source R2 backup and `product_images` metadata | Copy to the owner's R2 bucket at the same keys, preserving content types; verify every remaining `/api/images/` URL by GET. The static image refresh is not an R2 transfer |
| Release evidence | Manifests, migrations, build, backup, destination verification output | Archive together with the deployment identity; credentials must never enter the archive |

## Required order

1. Freeze the reviewed media manifest and archive the whole source release plus a fresh database/R2 backup. Keep Wix live. Run `npm run media:verify`. A changed checksum requires an explicit reviewed replacement; do not silently regenerate during deployment.
2. Configure `wrangler.prod.toml` with the owner's actual account/database/bucket. Apply base schema and migrations through 009. The production bootstrap deliberately defers 010 because a fresh database has no catalogue yet.
3. Seed only a genuinely empty catalogue, then complete the final Wix catalogue import (Phase 8). Preserve prepared media and stable product UUID/SKU/option-label identities. Never reseed a shop with orders. Reconcile new, removed or renamed options explicitly against the manifest; do not remove the migration guard to force success.
4. Copy remaining uploaded objects to the owner's R2 bucket. Build the complete release with `CONTENT_SNAPSHOT_SOURCE=committed npm run build`. Confirm every file in `public/media/` exists byte-for-byte in `dist/media/`. Deploy that full artifact to the owner's temporary Pages address, using the production configuration explicitly.
5. Apply `npx wrangler -c wrangler.prod.toml d1 execute salty-lamps-db --remote --file=d1/migrations/010-lighter-catalogue.sql` with the owner's database credential. The D1 file executor must apply the migration transactionally. It rejects ambiguous/missing options before any catalogue changes. Once recorded, replay does not overwrite later owner edits.
6. Run `npm run media:verify-cutover -- --url=https://salty-lamps.pages.dev` (substitute the owner's actual temporary address). It must report 100 matching image hashes, 73 correct assignments, and zero failures. Save the output. Also verify migrated R2 objects and the other generated videos against the release archive.
7. In the browser, exercise all multi-option products, same-price shapes, pack quantities, sold-out choices, quick preview, gallery thumbnails and the selected cart item. Inspect collection posters and play the Saltwood Frames and manufacturing films. Save/reload an owner photo assignment, then restore it. Any failed check blocks the domain switch.
8. After the Phase 15 domain switch, repeat the command against `https://www.saltylamps.co.uk`, repeat browser smoke checks and retain evidence. Only then mark the media cutover complete. Refresh the committed snapshot using the owner's explicit account and `CLOUDFLARE_D1_DATABASE_ID`; never let the default review database supply production content.

## Rollback

Keep the prior artifact, source media and pre-cutover database export. Before domain cutover, repair the new environment while Wix continues serving customers. After cutover, route the domain back to Wix if necessary. For a media-only reversal, restore only affected catalogue/content/image-assignment rows and the prior artifact; preserve orders and intervening inventory changes. Never restore a whole database over new orders. Reconcile the media-refresh ledger with a targeted reversal before reapplying migration 010.
