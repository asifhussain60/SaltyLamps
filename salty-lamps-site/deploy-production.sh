#!/usr/bin/env bash
# deploy-production.sh — stand up Salty Lamps on the OWNER'S OWN Cloudflare account.
#
# This is the production counterpart to deploy-cloudflare.sh (which targets the
# dev/UAT project on the hotmail account). It is intentionally account-agnostic:
# it hardcodes NO credentials. You bring the owner's account id + a token, and it
# provisions the database, image bucket, and Pages project, seeds the CATALOG ONLY
# (never demo orders), and deploys.
#
# It is safe to re-run: every provisioning step checks for existence first, and it
# NEVER wipes orders. The one destructive step (catalog reseed) is opt-in and gated.
#
# ---------------------------------------------------------------------------
# PREREQUISITES (owner does these once — see PRODUCTION-HANDOVER.md):
#   • A Cloudflare account (the owner's).
#   • An API token on that account with: Pages:Edit + D1:Edit + Workers R2 Storage:Edit.
#   • The owner's LIVE Stripe secret + webhook signing secret (set later, interactively).
#
# USAGE:
#   export CLOUDFLARE_API_TOKEN=...            # owner's token (Pages+D1+R2 Edit)
#   export CLOUDFLARE_ACCOUNT_ID=...           # owner's account id
#   export PROD_PROJECT=salty-lamps            # Pages project name (default: salty-lamps)
#   export PROD_SITE_URL=https://www.saltylamps.co.uk
#   ./deploy-production.sh
#
# Then follow the printed Stripe steps to attach the owner's live keys.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PROJECT="${PROD_PROJECT:-salty-lamps}"
BRANCH="${PROD_BRANCH:-master}"
DB_NAME="${PROD_DB_NAME:-salty-lamps-db}"
BUCKET="${PROD_BUCKET:-salty-lamps-images}"
SITE_URL="${PROD_SITE_URL:-}"

say()  { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

# Every wrangler call goes through here so they all agree on ONE config file.
#
# WHY: wrangler.toml carries the DEV/UAT database_id, which belongs to a different
# Cloudflare account. Deploying production against it binds the live shop to the
# UAT database and its simulated orders — a failure that looks like success.
# wrangler.prod.toml holds the owner's ids; PROD_CONFIG='' opts out if a caller
# genuinely wants the default file.
CONFIG="${PROD_CONFIG-wrangler.prod.toml}"
if [ -n "$CONFIG" ] && [ ! -f "$CONFIG" ]; then
  die "Missing $CONFIG. It holds the production D1 id and R2 binding; deploying
     without it would fall back to wrangler.toml, which points at the DEV
     database on a different account. Set PROD_CONFIG='' only if you mean that."
fi
PLACEHOLDER_DB=0
if [ -n "$CONFIG" ] && grep -q 'REPLACE_WITH_PRODUCTION_DATABASE_ID' "$CONFIG"; then
  PLACEHOLDER_DB=1   # first run: step 1 creates the database and stops, which is expected
fi
wr() {
  if [ -n "$CONFIG" ]; then npx wrangler -c "$CONFIG" "$@"; else npx wrangler "$@"; fi
}

# Apply one migration file, tolerating the single error that is benign here.
#
# WHY THIS EXISTS. Step 2 below applies d1/schema.sql and THEN every migration.
# schema.sql already creates `orders` with fulfilment_status, tracking_number,
# shipped_at and the ship_* columns, so 001-admin-portal.sql's bare
# `ALTER TABLE orders ADD COLUMN fulfilment_status ...` raises
# "duplicate column name" — on a FRESH database, not just a re-run. Under
# `set -euo pipefail` that killed the whole script before it ever reached the
# build and deploy steps. SQLite has no `ADD COLUMN IF NOT EXISTS` and no
# conditional DDL, so the loop has to absorb exactly that one error and nothing
# else: any other failure still aborts loudly with wrangler's own output.
#
# THE RULE THIS DEPENDS ON: migration files are APPEND-ONLY AS A SET. wrangler
# stops a file at its first failing statement, so a file whose first ALTER is a
# duplicate silently skips the rest of itself. That is harmless while every
# migration is all-or-nothing, and becomes a real bug the moment someone appends
# a column to an EXISTING migration file. A new column always means a NEW file.
apply_migration() {
  local file="$1" out rc
  set +e
  out=$(wr d1 execute "$DB_NAME" --remote --file="$file" 2>&1)
  rc=$?
  set -e
  if [ $rc -eq 0 ]; then
    ok "migration: $file"
  elif printf '%s' "$out" | grep -qi 'duplicate column name'; then
    warn "migration: $file — columns already present, skipped."
  else
    printf '%s\n' "$out" >&2
    die "Migration failed: $file"
  fi
}

# --- 0. Auth sanity -----------------------------------------------------------
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -z "${CF_ALLOW_INTERACTIVE:-}" ]; then
  die "No CLOUDFLARE_API_TOKEN set. Export the owner's token (Pages+D1+R2 Edit) and
     CLOUDFLARE_ACCOUNT_ID, or set CF_ALLOW_INTERACTIVE=1 to use 'wrangler login'."
fi
say "Deploying to Cloudflare account: ${CLOUDFLARE_ACCOUNT_ID:-<interactive login>}"
wr whoami 2>/dev/null | grep -i account || true

# --- 1. D1 database -----------------------------------------------------------
say "Ensuring D1 database '$DB_NAME' exists…"
if wr d1 info "$DB_NAME" >/dev/null 2>&1; then
  ok "D1 database already exists."
else
  wr d1 create "$DB_NAME"
  warn "Created a NEW D1 database. Copy the printed database_id into ${CONFIG:-wrangler.toml}"
  warn "before the deploy step can bind it."
  die  "Re-run this script after wiring the database_id."
fi

# The database exists, so the id in the config must be the real one. Catching the
# placeholder here — rather than at the deploy step — means the failure names the
# cause instead of surfacing as a binding error against a live site.
if [ "$PLACEHOLDER_DB" = "1" ]; then
  die "$CONFIG still has the placeholder database_id, but '$DB_NAME' exists.
     Run:  npx wrangler -c $CONFIG d1 info $DB_NAME
     and paste its uuid into the database_id line of $CONFIG, then re-run."
fi

# --- 2. Schema + migrations + CATALOG seed (never demo orders) ----------------
say "Applying schema + migrations to '$DB_NAME' (remote)…"
wr d1 execute "$DB_NAME" --remote --file=d1/schema.sql
for m in d1/migrations/*.sql; do
  [ -e "$m" ] || continue
  apply_migration "$m"
done

# Catalog seed is destructive (it deletes+reinserts products/skus). Gate it so a
# re-run against a live shop can't orphan real order_items. Opt in with SEED_CATALOG=1.
if [ "${SEED_CATALOG:-0}" = "1" ]; then
  EXISTING=$(wr d1 execute "$DB_NAME" --remote --json \
    --command "SELECT COUNT(*) AS n FROM orders;" 2>/dev/null \
    | grep -oE '"n": *[0-9]+' | head -1 | grep -o '[0-9]*' || echo 0)
  if [ "${EXISTING:-0}" != "0" ]; then
    die "Refusing to reseed catalog: $EXISTING orders already exist in prod.
       Reseeding deletes+reinserts skus and would orphan real order_items.
       Update the catalog with a targeted UPSERT instead (see PRODUCTION-HANDOVER.md)."
  fi
  say "Seeding CATALOG (products + skus) — no demo orders…"
  wr d1 execute "$DB_NAME" --remote --file=d1/seed.sql
  ok "Catalog seeded."
else
  warn "Skipped catalog seed (set SEED_CATALOG=1 on a fresh DB to load d1/seed.sql)."
fi

# --- 3. R2 bucket for admin-uploaded images -----------------------------------
say "Ensuring R2 bucket '$BUCKET' exists…"
if wr r2 bucket list 2>/dev/null | grep -q "$BUCKET"; then
  ok "R2 bucket already exists."
else
  wr r2 bucket create "$BUCKET"
  ok "Created R2 bucket '$BUCKET'."
fi

# --- 4. Build -----------------------------------------------------------------
say "Building (npm run build)…"
npm run build
ok "dist ready ($(du -sh dist | cut -f1))"

# --- 5. Deploy ----------------------------------------------------------------
say "Deploying Pages project '$PROJECT' (branch $BRANCH)…"
wr pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true

# --- 6. Stripe secrets (owner's LIVE keys) — interactive, owner-entered --------
cat <<EOF

────────────────────────────────────────────────────────────────────────
✅ Code + data deployed to project '$PROJECT'.

FINAL STEP — attach the OWNER'S OWN LIVE Stripe keys as Pages secrets.
Run these three commands and paste each value when prompted (values are
never stored in this repo):

  npx wrangler pages secret put STRIPE_SECRET_KEY      --project-name $PROJECT
  npx wrangler pages secret put STRIPE_WEBHOOK_SECRET  --project-name $PROJECT
  npx wrangler pages secret put SITE_URL               --project-name $PROJECT
      # value: ${SITE_URL:-https://www.saltylamps.co.uk}

Then in the Stripe Dashboard (owner's account) add a webhook endpoint:
  https://<your-domain>/api/webhook   → event: checkout.session.completed
and copy its signing secret into STRIPE_WEBHOOK_SECRET above.

See PRODUCTION-HANDOVER.md for the full Stripe ownership-transfer checklist.
────────────────────────────────────────────────────────────────────────
EOF
