# Salty Lamps post cutover parking lot

Recorded 3 October 2026 at Asif's request. **Gallery resumed and visually approved by Asif on 3 October; the independent testing environment remains parked.** Asif subsequently requested repository groundwork, an initial-release assessment, and a preview on the test site. After reviewing the local preview, Asif said: "I love it, release it to prod when done". This authorizes production publication of the frames, not lifting the public testing restriction, data changes, new hosted resources, domain changes or payment tests.

## Resumed gallery preview and initial-release assessment

- Candidate maintained on `codex/gallery-frame-preview` in a separate worktree, based on the currently deployed `2089b10` launch revision. The primary `golive` checkout is left intact.
- Asif accepted the local preview and authorized production release. The approved frame treatment is now enabled on `/gallery` by default; the temporary hostname/query gate was removed before release.
- Design: equal-width warm brown rails on all four sides, bevelled corners, a narrow recessed inner rim and modest shadow. The frame narrows on phones. Existing names, links, ordering, mosaic spans and label visibility are preserved. Product-detail galleries, cards elsewhere and the administrator are outside this change.
- This is a presentation-only candidate: no migration, new dependency, product write or payment change. Asif has accepted the visual preview; it is suitable for inclusion in the initial release while the existing launch gates remain separate. The larger isolated-test-shop plan is not a prerequisite for this read-only visual review.
- The test address still shares live-mode services and real data with www. Review gallery appearance and product navigation only. Do not run the write-capable browser suite, place test orders, upload photos or edit stock there.
- Use `deploy-live.sh` for the preview code deployment because www is already attached. It preserves live configuration and saves a private export plus recovery bookmark before publishing. The preview does not lift the public testing restriction.
- The approved frame treatment is enabled for customers in the release candidate. Rerun desktop/phone and navigation checks, refresh the read-only catalogue snapshot, and publish through the guarded release path. Public opening still requires the launch decision.
- Rollback for the preview is a code revert followed by the guarded live release. Do not restore the database or select a historic sandbox deployment.

Verification of the initial gated preview: all 258 unit checks passed, including hostname/query boundaries; the production build passed its search and media checks. Local browser review used a read-only catalogue fixture from a freshly refreshed snapshot, at desktop and phone widths. All 24 gallery captions fitted; no horizontal overflow on the phone. The accepted design has been published and verified on both test and www; all 255 final unit tests passed. Hosted verification and release recovery evidence are recorded in `gallery-frame-preview.md`.

This plan covers a safe place to test future changes, a repeatable recovery and release process, and the first requested visual change: picture-frame borders around gallery tiles. It is separate from the current launch work and must not become a new launch dependency.

## Starting position and boundaries

The configuration reviewed on 3 October points the existing test and live release configurations at the same shop project and database. That database holds the owner's real catalogue, stock and edits. The current test address is therefore not an isolated playground; once the project uses live payments, that address can also reach live checkout. This is a configuration finding, not a fresh confirmation of public launch status.

Keep the agreed promotion of the existing shop intact. Do not rename, recreate, reset or reseed it for this plan. Keep existing cutover documentation and concurrent work untouched. All future hosted resources must belong to the approved Salty Lamps owner account. The empty reserve database and holding site remain reserved for their existing purpose.

## Deferred plan

### 1. Establish a verified recovery baseline after cutover

> Review the actual completed launch state, then save a dated private database export and recovery bookmark alongside the deployed code version and a record of its configuration. Cover photo storage separately and prove the export can be restored into a disposable database without touching the customer shop; account for any export impact by arranging a suitable window.
>
> *Value gained:* Future changes start from a known, recoverable shop state.

Record the source database, export integrity check, deployed version, configuration and secret names without secret values, photo recovery coverage, and restore-test result in private recovery evidence. Choose retention and refresh frequency when this work resumes. Take another export and bookmark immediately before every production release, cleanup or data repair, following existing project safeguards.

### 2. Create an independent shop for testing future changes

> Create a separate protected hosting project, database, photo storage and test administrator under the approved owner account. Start with a temporary protected address, then assign test.saltylamps.co.uk only after the cutover no longer depends on its current attachment and the new environment has passed isolation checks.
>
> *Value gained:* Testing cannot alter real stock, customer orders, images or payments.

| Area | Customer shop | Independent test shop |
| --- | --- | --- |
| Code | Approved production version | Candidate based on the production version |
| Catalogue and stock | Authoritative owner records | Copied catalogue and disposable stock |
| Orders and customer details | Real business records | Artificial examples; anonymised minimum data only if needed for a specific defect |
| Photos | Production storage | Separate copied storage using the same storage approach |
| Payments and callbacks | Live credentials and destinations | Sandbox credentials and separate sandbox destinations |
| Email and background processing | Customer delivery and real work | Captured mail or approved test recipients; no replay of copied jobs |
| Access | Public storefront and protected administrator | Protected storefront and separate test administrator |
| Search visibility | Customer address | Excluded from indexing |

Keep data refresh one-way: production to the isolated test database. Strip customer details, live payment references, pending email jobs and other actionable records before enabling the copy. Never copy test records back into production. Match production behaviour and relevant provider versions where practical; deliberate differences are credentials, destinations and disposable data.

Before any write-capable test, verify actual deployed connections as well as configuration: database, storage, payment mode, callback destinations, mail and access protection must all be isolated. A test stock change or image upload must leave production unchanged. Add release guards that reject production resources in the test configuration and sandbox settings in a production release. Reconcile the current instruction to retire the old test address with its later reuse for this independent environment.

### 3. Reproduce real errors safely and release reviewed fixes

> Inspect production logs and affected records without changing them, then reproduce the issue with the smallest useful example in the independent test shop. Verify the repair through the affected customer or administrator journey, and release the reviewed code through the guarded production process only after Asif approves it.
>
> *Value gained:* Fixes are proven before they reach customers, while new orders remain protected.

Develop in a separate branch and working copy from concurrent launch work. Record the error, affected journey, reproduction, expected behaviour and evidence that the fix works. Use focused checks plus real browser verification; a sandbox result does not prove a production-only provider issue is resolved. Verify the released journey and relevant logs on production without generating unapproved charges or customer emails.

Promote the reviewed code version, with environment-specific configuration and reviewed database migrations where required. Never promote the test database. Recheck any live catalogue snapshot required by the existing release process.

Prefer reverting compatible code to a known-good **live-mode** release or applying a targeted forward fix. Do not select a historical sandbox deployment as a production rollback. Database recovery is a separate exceptional decision: preserve and reconcile orders and stock changes made since the recovery point before any restoration. For urgent payment or order failures, contain the affected journey before proceeding with investigation, using the incident authority agreed at that time.

### 4. Give the gallery tiles borders designed as picture frames

> Asif wants the image tiles in the supplied gallery screenshot to look framed, with a visible surround on all four sides. Prepare a preview showing a balanced outer frame, a recessed inner edge and restrained depth; a warm wood-toned finish is a proposed option, with the final finish and thickness to be chosen from the preview.
>
> *Value gained:* The gallery presents the lamp photographs as individually framed pieces while keeping the products prominent.

**User requirement:** picture-frame borders around the gallery image tiles. A simple coloured line along one edge does not satisfy this request. The screenshot shows a mosaic with a wide angel-lamp tile followed by sphere and block-lamp tiles, product names overlaid at the bottom, and further tiles below.

**Proposed design to preview after resumption:** a consistent frame treatment around wide, tall and standard tiles; an inset bevel or narrow mount to separate the photo from the frame; a subtle external shadow; and thickness that reduces appropriately on phones. Use the existing cream, amber and brown palette as a starting point. Frame material, texture, corner treatment and exact dimensions remain unapproved design choices.

Keep existing product links, names, ordering and mosaic layout. Scope the change to the customer gallery; preserve the administrator, product records and existing label-visibility decisions. Place the image, caption and overlay inside the framed opening so the frame does not cover them. Preserve useful image visibility and check crops individually. Keep keyboard focus distinct from the decorative frame, touch targets usable, and motion respectful of reduced-motion settings.

Preview representative wide and standard tiles together, plus a phone layout, before implementation. On the isolated test site, check every gallery tile, long titles, bright and dark photographs, hover, keyboard focus, narrow widths and product navigation. Confirm the frame has balanced edges, no clipping or overflow, and no effect on unrelated product cards or checkout. Seek Asif's visual acceptance before a production release.

### 5. Make the accepted workflow the normal route for future work

> Document the verified environment boundaries, refresh procedure, recovery steps and release checks once the separate test shop exists. Keep future requests in this parking lot until they are explicitly selected, then close them with evidence from the test site and the approved production release.
>
> *Value gained:* Later changes follow a consistent process without reopening cutover decisions.

## Completion conditions for this parked work

| Item | Evidence required when resumed | Current status |
| --- | --- | --- |
| Recovery baseline | Private export, bookmark, photo coverage and disposable restore evidence | Parked; not performed |
| Independent test shop | Separate deployed resources, protected access and verified isolation | Parked; not provisioned |
| Error and release workflow | Reproduced issue, tested repair, approval, controlled release and live verification | Parked; not executed |
| Framed gallery tiles | Accepted preview, verified gallery behaviour and approved release | Complete: accepted by Asif, released to production, desktop/phone and both hosted gallery addresses verified |

## Maintainer references

- Cutover handoff: `../../handover/golive/README.md` and its state and guide documents. Re-read current versions when resuming; their launch status can change independently of this plan.
- Project safeguards: `../../AGENTS.md`, `../../infra/account-ownership.md`, and `migration.md`.
- Existing release configuration: `../wrangler.live.toml`, `../wrangler.staging.toml`, and `../deploy-live.sh`.
- Gallery implementation: `../src/App.jsx` (`gallery-mosaic` and `gallery-card`) and `../src/styles/saltylamps.css`. Product-detail image galleries are a different surface.
- Design reference reviewed: local UI style catalog, Panels And Cards and Media, Gallery, And Sliders; Boomerang card borders and overlay structure. Any future adaptation must be copied into this project and scoped locally. No runtime dependency on the theme archive is permitted.
- [Cloudflare resource bindings](https://developers.cloudflare.com/pages/functions/bindings/) support separate environment resources; verify the resulting deployed connections.
- [Cloudflare database recovery](https://developers.cloudflare.com/d1/reference/time-travel/) overwrites a database in place. Use an export/import into a disposable database for recovery testing; do not assume the recovery command creates a clone.

The original parking request created this planning document only. The subsequent preview request is tracked in the resumption section above; the remaining environment and workflow work stays parked.
