# Go-live hand-off package (branch `golive`)

**Development split completed 3 October 2026:** `test.saltylamps.co.uk` is a separate development project/database/image bucket, with the same storefront catalogue snapshot and empty customer operations. Live www/admin retain their existing project, database, images and release. Read `salty-lamps-site/docs/development-environments.md` before any further release or test work. `publish.sh test` targets only development; `main` records the exact currently live commit; `develop` holds the development code and is the test project’s deployment branch. `publish.sh sign-off` records actual owner acceptance and Asif’s explicit production approval for the exact hosted test release; `publish.sh live` promotes that signed-off code and only then advances main. Other branches are retired after private recovery copies. Data is never promoted from development to live.

Everything needed to finish taking the Salty Lamps shop live in a fresh agent session.

| File | What it is |
|---|---|
| `CODEX-PROMPT.md` | The prompt to paste into Codex to start. |
| `STATE.md` | Exactly where things stand on 2 October 2026, the ids, the facts that bite, the never-do list. |
| `GUIDE.md` | The 18-step walkthrough, with four gates where Asif must say "yes" first. |
| `status.sh` | One read-only command that shows the current state of everything. |

**To start:** open Codex in `~/PROJECTS/SaltyLamps` on the `golive` branch and paste the prompt from
`CODEX-PROMPT.md`.

**Public launch completed 3 October 2026 with Asif’s explicit approval and reported owner acceptance.**
The temporary holding and launch-page rewrite rules are disabled; the secure www redirect remains
active. Public storefront access was verified from an outside network, all 11 read-only launch
checks passed, and administrator sign-in remains protected. The test hostname is still retained.
See `infra/public-launch-verification-2026-10-03.json` for evidence and rollback.
`STATE.md` below its latest-status note and the guide retain historical preparation details.
