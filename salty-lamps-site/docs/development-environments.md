# Live and development shops

Created 3 October 2026. This is the current release runbook; older migration instructions describe the pre-launch shared test shop.

## Fixed destinations

| Resource | Live | Development |
| --- | --- | --- |
| Code branch | main — exact deployed live commit | develop — committed development work |
| Shop | https://www.saltylamps.co.uk | https://test.saltylamps.co.uk |
| Administrator | https://admin.saltylamps.co.uk/admin | https://test.saltylamps.co.uk/admin |
| Pages project | salty-lamps-staging | salty-lamps-development |
| Database | salty-lamps-staging-db | salty-lamps-development-db |
| Database ID | 981a6d7b-8eb7-4057-8023-d2a4894c21e4 | 62066199-f4b8-4026-8dd2-b56a10cd975d |
| Uploaded images | salty-lamps-images | salty-lamps-development-images |
| Configuration | wrangler.live.toml | wrangler.development.toml |
| Money | Owner's live Stripe connection | Test keys only; keys not installed yet |
| Email | Owner's live sending configuration | Dry-run only; no sending key |

Both projects belong only to the approved Salty Lamps owner account. The misleading old `staging` resource names now refer to live customer data. Never use the old staging deploy/import/bootstrap scripts for development. `deploy-staging.sh` already refuses while www is attached.

The existing test-host Access protection was retained, including its approved recipients. Shop and administrator share the protected test hostname; the administrator additionally verifies the signed Access identity. Development Pages aliases refuse shop/API/admin requests, so they cannot bypass the protected test address. Static public images/assets may remain reachable at Pages aliases; no private customer operations were copied into development.

## Snapshot and replica

The dated private recovery folder is `~/salty-lamps-private/development-snapshot-20261003`, outside Git, with owner-only permissions. It contains the full live database export, Time Travel bookmark, verified local restore, deployed and current Git source archives, Git bundle, hosting/DNS metadata and all 13 uploaded image objects with checksums. The full recovery database contains private customer data and must never be uploaded as a development fixture or checked into Git.

The development copy preserves the catalogue, stock, prices, descriptions, content and public archived reviews. Customer/order, reservation, checkout attempt, email/outbox, support and audit operations are emptied. Sending is disabled; the stored site address names test. Inactive legacy database image chunks were removed from the replica; the active R2 images were copied independently. Every one of the 39 remote development tables was compared with the prepared local copy. Catalogue edits after this snapshot do not synchronize automatically.

Do not rerun replica preparation or imports against a populated development environment. Existing developer work must be exported and reviewed first. No import command is included in the publish workflow.

## Branch policy

Only `main` and `develop` are active branches. `main` identifies the code actually running on the live shop; it is not advanced merely because development is ready. `develop` contains all retained feature work and is the only branch allowed to publish the test shop. The test Pages project’s production branch is `develop`; the live project’s is `main`. These are separate Pages projects with separate resources, not two bindings within the same project.

Both existing projects use Direct Upload. GitHub pushes do not automatically publish either shop. Branch connection is enforced by the Pages project setting, deployment branch metadata and guarded publishing script. This keeps production sign-off mandatory. [Cloudflare branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/) documents changing the branch for Direct Upload projects.

Do not manually merge develop into main before publishing. The promotion script advances main to the reviewed commit only after Cloudflare confirms that exact commit is live. If `--push` is supplied, it then pushes main without force; otherwise the main update stays local.

## Daily code publishing

From `salty-lamps-site`, with `develop` checked out:

```sh
./publish.sh test --dry-run
./publish.sh test
./publish.sh snapshot
```

Commit all development changes before publishing test. The test dry run may inspect uncommitted edits, but an actual test publication requires a clean develop checkout. The test dry run checks the fixed configuration, unit tests and negative target tests, then builds an immutable private copy without remote access. Publishing checks the actual development database/image identity, saves a development export/bookmark, and deploys only that copied code to the fixed development project. Credentials, local `.dev.vars` and local databases are excluded. Checks and deployment receipts are saved privately. The test shop has a conspicuous sandbox banner and noindex responses. `release.json` records the non-secret code identity.

Legacy local `.dev.vars` test keys did not match the recorded approved owner sandbox when inspected on 3 October. They were not copied. Have the owner install the correct sandbox keys on the **development project only** before a checkout rehearsal. Until then payment creation fails safely. Never install a live key or a sending key on development.

## Promoting reviewed code

After the owner tests the exact hosted develop release and Asif explicitly signs it off for live publication, record that real decision. Never manufacture sign-off during routine commit or test publishing:

```sh
./publish.sh sign-off --approved-by Asif --owner-accepted --note "Owner accepted the test result; Asif approved this release for production"
```

This writes a private approval record tied to the exact commit, source fingerprint and hosted test deployment. It deploys nothing. A changed commit, changed source or redeployment requires fresh review and sign-off. Then:

```sh
./publish.sh live --dry-run
./publish.sh live --push
```

Commit the final reviewed version and publish it to test first. Live promotion requires a matching private owner-acceptance/production-sign-off record. The low-level live deployment script also verifies that record and the still-current hosted test release before any live write. Live promotion refuses a dirty checkout, an untested fingerprint/commit, or a hosted test deployment different from its recorded receipt. The development and live configurations are separate and pinned. Live builds and publishing run from an independent private clone of the exact signed-off develop commit, so edits in the shared working folder cannot change a release while approval or backups are pending. Before any live deployment it checks both actual resource identities, takes a full private live snapshot, and calls the existing guarded `deploy-live.sh`. That path checks live target, migration ledger, fresh owner catalogue snapshot, provider readiness, and requires the explicit `deploy live` phrase before publishing. Refreshing the committed catalogue snapshot changes the fingerprint: publish and review that final committed version in test again before promotion.

Promotion never imports development products, stock, orders, settings, customers or images into live. Shared application code is rebuilt with the appropriate environment configuration; the test banner/sandbox switches never enter the live build. Schema migrations and image/content changes are separate business-reviewed actions, with separate backups; this script does not apply them.

## Isolation checks

Development has a `deployment_environment=development` database setting and a reserved `_environment/development.json` image-bucket identity. Runtime middleware rejects mismatched database/bucket identities, missing environment identity and incompatible provider credentials before reaching commerce handlers. Production has no development marker; the future production configuration explicitly declares `production`. The currently running live release remains unchanged by this work.

Negative tests cover live database/bucket substitution, missing safety switches, wrong hosts/account, live payment keys, a sending key and forged/missing administrator credentials. A real development-only setting write/read/delete probe can additionally verify that the live database never receives the key.

These safeguards prevent accidental mixing through the supplied workflow and guarded application. The owner account administrator can still deliberately change bindings, credentials or code through Cloudflare or another tool. Absolute prevention of administrator overrides requires separately scoped credentials/accounts; that permission change is not part of this request. Never run raw release/import commands to bypass these checks.

## Recovery

Development rollback uses a known development deployment on `salty-lamps-development`, preserving its own bindings and credentials. Live rollback uses a known **live** deployment on `salty-lamps-staging`; never select an old sandbox deployment from before launch. Preserve both database bookmarks and exports. Restoring live data, moving www or changing live provider credentials requires explicit business approval. Only the test hostname was moved for this development split; www, admin and mail routing were preserved.
