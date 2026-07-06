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

> **Account note (2026-07-06):** the `salty-lamps-proposal` project is **not** in
> the `asifhussain60@gmail.com` account whose id is `19cb05067ea7e704f94481df1685ec51`
> (that account only holds `asif-academy`). Deploys must authenticate against the
> Cloudflare account that actually owns `salty-lamps-proposal.pages.dev`. Use an
> API token from that account, or `wrangler login` into it.

## Quick deploy

```bash
cd salty-lamps-site

# Option A — non-interactive (recommended): token from the owning account
export CLOUDFLARE_API_TOKEN=...      # Pages:Edit permission
export CLOUDFLARE_ACCOUNT_ID=...     # the owning account's id
./deploy-cloudflare.sh

# Option B — interactive: opens a browser to log in
./deploy-cloudflare.sh
```

`deploy-cloudflare.sh` builds, then runs
`wrangler pages deploy dist --project-name salty-lamps-proposal --branch master --commit-dirty=true`.
With a token it is fully hands-off; without one it falls back to browser OAuth.

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
