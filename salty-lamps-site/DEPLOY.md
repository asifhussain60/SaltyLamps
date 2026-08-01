# Deploying salty-lamps-site to Cloudflare Pages (DEV / UAT)

Self-contained deployment record for the **dev / UAT** environment. Adapted from
the canonical infra reference at
`podcast-factory/infra/cloudflare/salty-lamps-proposal.md` so this repo no longer
depends on that folder to redeploy.

> **This is the DEV / UAT site, not the customer shop.** `salty-lamps-proposal.pages.dev`
> is where changes and the admin portal are tested, and it is deliberately loaded
> with simulated demo orders for UAT. Real production is a separate deployment on
> the **owner's own** Cloudflare account — see `PRODUCTION-HANDOVER.md` and
> `deploy-production.sh`.

## Target

| Field | Value |
|---|---|
| Pages project | `salty-lamps-proposal` |
| Env | Dev / UAT |
| URL | https://salty-lamps-proposal.pages.dev |
| Deploy branch | `master` |
| Build command | `npm run build` (Vite build + `scripts/generate-seo.mjs`) |
| Build output | `dist` |
| Framework | React 18 + Vite 5 |

> **Account:** the `salty-lamps-proposal` project — and its D1 database
> `salty-lamps-db` and R2 bucket `salty-lamps-images` — live in the
> **`Asifhussain60@hotmail.com`** Cloudflare account (id
> `844bc687926c910d5ad9d79c40ad1f2f`). All deploys and data commands must
> authenticate against this account.
>
> **Token scope:** the saved Keychain token is **Pages: Edit only** — enough for
> `wrangler pages deploy`, but it CANNOT create the R2 bucket or run D1 commands
> (you'll get `7403`/`10000`). A Functions deploy also fails if the R2 bucket
> `salty-lamps-images` doesn't exist yet. For R2/D1 work, use a broader token
> (Pages:Edit + D1:Edit + Workers R2 Storage:Edit) or an interactive
> `wrangler login` to the hotmail account.

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
interactive browser OAuth (sign into the hotmail account when the browser opens).

## Where the credentials live (this machine)

Saved once in the macOS Keychain, read automatically by
`deploy-cloudflare.sh` (same pattern as `scripts/generate-aura-video.py`'s
`gemini_api_key` lookup):

| Keychain service | Account field | Holds |
|---|---|---|
| `salty-lamps-proposal-cloudflare-token` | `salty-lamps-proposal` | API token (hotmail account; currently Pages: Edit only) |
| `salty-lamps-proposal-cloudflare-account-id` | `salty-lamps-proposal` | `844bc687926c910d5ad9d79c40ad1f2f` |

To rotate the token: create a new one in the hotmail account's dashboard, then
overwrite with `security add-generic-password -s salty-lamps-proposal-cloudflare-token
-a salty-lamps-proposal -w '<new token>' -U`, and delete the old token in the
Cloudflare dashboard. If you also need R2/D1 from the script, create the new
token with **Pages:Edit + D1:Edit + Workers R2 Storage:Edit** and save it the
same way — the script and all data commands will then work headlessly.

## Build-time environment

None. The build reads no `VITE_*` variables.

Until August 2026 this section documented `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, read by a Supabase client that the storefront's chat,
trade and newsletter forms wrote to. Those forms now post to
`/api/support/enquiry`, which stores to D1 and emails the owner, so the client,
its two variables and the `@supabase/supabase-js` dependency are all gone. Any
copy of `.env.local` still carrying those two keys is harmless and unread.

## Creating an API token (Option A)

In the Cloudflare dashboard of the **owning** account →
My Profile → API Tokens → Create Token → use the **"Cloudflare Pages — Edit"**
template (or a custom token with `Account › Cloudflare Pages › Edit`). Copy the
token and the account id, then run Option A above. Rotate/delete the token after
if it was shared.
