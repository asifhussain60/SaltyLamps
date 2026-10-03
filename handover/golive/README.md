# Go-live hand-off package (branch `golive`)

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
