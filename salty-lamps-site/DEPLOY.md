# Deploying salty-lamps-site to Cloudflare Pages

Self-contained deployment record. Adapted from the canonical infra reference at
`podcast-factory/infra/cloudflare/salty-lamps-proposal.md` so this repo no longer
depends on that folder to redeploy.

## Target

| Field | Value |
|---|---|
| Pages project | `salty-lamps-proposal` |
| Live URL | https://salty-lamps-proposal.pages.dev |
| Production branch | `master` |
| Build command | `npm run build` (Vite build + `scripts/generate-seo.mjs`) |
| Build output | `dist` |
| Framework | React 18 + Vite 5 |

> **Account note (2026-07-06):** the `salty-lamps-proposal` project lives in the
> **`Asifhussain60@hotmail.com`** Cloudflare account (id
> `844bc687926c910d5ad9d79c40ad1f2f`) — **not** the `asifhussain60@gmail.com`
> account (id `19cb05067ea7e704f94481df1685ec51`, which only holds
> `asif-academy`; `wrangler` on this machine is logged into that one). Deploys
> must authenticate with a token from the hotmail account.

## Quick deploy

```bash
cd salty-lamps-site
./deploy-cloudflare.sh
```

That's it — the token and account id are saved in this Mac's Keychain (see
below), so no manual auth is needed on this machine. `deploy-cloudflare.sh`
builds, then runs
`wrangler pages deploy dist --project-name salty-lamps-proposal --branch master --commit-dirty=true`.

On a machine without the Keychain entries, either set env vars first:

```bash
export CLOUDFLARE_API_TOKEN=...      # Pages:Edit permission, hotmail account
export CLOUDFLARE_ACCOUNT_ID=844bc687926c910d5ad9d79c40ad1f2f
./deploy-cloudflare.sh
```

or just run `./deploy-cloudflare.sh` with no token set — it falls back to
interactive browser OAuth (make sure to log into the hotmail account, not
gmail, when the browser opens).

## Where the credentials live (this machine)

Saved once in the macOS Keychain, read automatically by
`deploy-cloudflare.sh` (same pattern as `scripts/generate-aura-video.py`'s
`gemini_api_key` lookup):

| Keychain service | Account field | Holds |
|---|---|---|
| `salty-lamps-proposal-cloudflare-token` | `salty-lamps-proposal` | API token (Pages: Edit, hotmail account) |
| `salty-lamps-proposal-cloudflare-account-id` | `salty-lamps-proposal` | `844bc687926c910d5ad9d79c40ad1f2f` |

To rotate the token: create a new one in the hotmail account's dashboard, then
overwrite with `security add-generic-password -s salty-lamps-proposal-cloudflare-token
-a salty-lamps-proposal -w '<new token>' -U`, and delete the old token in the
Cloudflare dashboard.

> Two now-deleted Keychain items, `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
> (generic names, scoped to the **gmail/asif-academy** account), used to shadow
> any token a script might read by that literal env var name — they didn't apply
> to this project and were removed on 2026-07-06 to avoid confusion. The unrelated,
> clearly-named `asif-academy-cloudflare` Keychain item for the asif-academy
> project was left untouched.

## Build-time environment

`src/lib/supabase.js` reads two `VITE_*` vars, baked into the bundle at build
time. They live in `.env.local` (git-ignored) — already present in this repo:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key (safe for the browser) |

No Cloudflare Pages dashboard env vars are needed — Vite bakes these in.

## Creating an API token (Option A)

In the Cloudflare dashboard of the **owning** account →
My Profile → API Tokens → Create Token → use the **"Cloudflare Pages — Edit"**
template (or a custom token with `Account › Cloudflare Pages › Edit`). Copy the
token and the account id, then run Option A above. Rotate/delete the token after
if it was shared.
