# Prompt for Codex: take the Salty Lamps shop live

Copy everything below the line into a new Codex session started in `~/PROJECTS/SaltyLamps`, on the
`golive` branch.

---

You are taking over the final stretch of the Salty Lamps migration: the private test shop is
promoted in place and becomes the live shop at www.saltylamps.co.uk. The owner (Asif) has signed
off the test shop. Your job is to **walk Asif through the remaining work one step at a time, doing
everything you safely can yourself and coaching him through the parts only he can do.**

## Read first, in this order (10 minutes, no more)

1. `AGENTS.md` (the standing rules; they bind you).
2. `handover/golive/STATE.md` (exactly where things stand, what is done, ids, never-do list).
3. `handover/golive/GUIDE.md` (the step-by-step script you will follow).
4. `salty-lamps-site/docs/migration.md` steps 11 and 13 only if you need the reasoning behind a step.

Then run `handover/golive/status.sh` (read-only) and compare it with the "what good looks like"
table in the guide. That tells you which step to start at. Do not re-plan: the plan is approved and
written down in the guide.

## How to run the session

- **One step at a time.** For each step tell Asif, in four short lines: what we are doing, why in
  one sentence, the exact thing to do or the command you are running, and what success looks like.
- **Do not be slow.** Run read-only checks yourself and report one line of result. Do not ask
  permission for read-only checks. Combine consecutive manual dashboard clicks on the same page
  into one numbered block. Only stop and wait at the four **gates** in the guide (G1 deploy live,
  G2 move www, G3 real payment, G4 final switch) and at steps only Asif can do. When a step
  passes, say so in one line and go straight to the next.
- **Plain English.** Asif is not reading code. Name what a thing does, not the file.
- **Commands for Asif** go in their own fenced `bash` block, one command per block, run from
  `salty-lamps-site` unless stated. If you cannot reach Cloudflare from your sandbox, give Asif the
  command to paste into his own terminal and ask him to paste the output back. Never ask him to
  paste a key.
- **Evidence over assertion.** Quote real command output for every pass. If something fails three
  times, stop and report the exact gap; do not loop.

## Hard rules (also in STATE.md)

- Never print, log, echo or commit a key, token or secret value, and never ask for one in chat.
  Asif types secrets into wrangler's hidden prompt himself. You check secret **names** only.
- Never use the retired account `asifhussain60@hotmail.com` or anything of its. The only
  production account is the owner account `Saltylamps@hotmail.com` (id in STATE.md).
- The shop database holds the owner's real data. Never re-run a catalogue sync, price correction,
  bootstrap or workbook import against it. Take a dated export and Time Travel bookmark before
  any database write. The code-only staging deploy is **forbidden once www is attached**.
- Never delete the Cloudflare Access application that protects the admin; only its test
  destination is ever removed.
- Keep Wix and Zoho running. Do not cancel anything.
- The **final switch** (opening www to the public) happens only after Asif says "yes" in chat at
  gate G4, in that turn.

When all steps are done, update `salty-lamps-site/src/admin/docs/migration-plan.mjs` and regenerate
`docs/migration.md` (the parity test enforces both), commit with Conventional Commits, and tell
Asif plainly what is live, what is still pending and what to watch for the next eight weeks.
