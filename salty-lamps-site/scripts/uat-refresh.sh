#!/usr/bin/env bash
# uat-refresh.sh — load the simulated demo orders into the DEV/UAT remote D1 so
# testers can exercise the admin portal (Dashboard, Reports, Orders) with a
# realistic year of activity.
#
# SAFE BY DESIGN:
#   • Backs up the remote D1 to d1/backups/ FIRST (real catalog + any real orders).
#   • Verifies the catalog (skus) exists remotely before loading — demo order_items
#     reference skus, so a missing catalog would silently produce empty orders.
#   • Only inserts rows prefixed 'demo_order_' (from d1/demo-orders-seed.sql), which
#     never collide with real Stripe session ids and are wiped by d1/reset-demo-orders.sql.
#   • Never touches products/skus.
#
# TARGET: the hotmail dev account. Auth must be able to run D1 --remote, i.e. EITHER
#   • a broad token exported as CLOUDFLARE_API_TOKEN (Pages+D1+R2 Edit) + CLOUDFLARE_ACCOUNT_ID, OR
#   • an interactive `wrangler login` into the hotmail account.
# (The saved Pages-only Keychain token is NOT enough for D1 — you'll get 7403.)
#
# USAGE:  ./scripts/uat-refresh.sh
#         RESET_FIRST=1 ./scripts/uat-refresh.sh   # wipe existing demo rows before reloading
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

DB_NAME="${DEV_DB_NAME:-salty-lamps-db}"
say()  { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }
wr()   { npx wrangler "$@"; }

# --- 1. Backup remote D1 (real data) -----------------------------------------
mkdir -p d1/backups
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="d1/backups/salty-lamps-db-${STAMP}.sql"
say "Backing up remote D1 '$DB_NAME' → $BACKUP"
wr d1 export "$DB_NAME" --remote --output="$BACKUP" || die "Backup failed (auth? see header)."
ok "Backup written ($(du -h "$BACKUP" | cut -f1))."

# --- 2. Verify catalog exists remotely ---------------------------------------
say "Checking catalog (skus) exists remotely…"
SKU_COUNT=$(wr d1 execute "$DB_NAME" --remote --json \
  --command "SELECT COUNT(*) AS n FROM skus;" 2>/dev/null \
  | grep -oE '"n": *[0-9]+' | head -1 | grep -o '[0-9]*' || echo 0)
[ "${SKU_COUNT:-0}" -gt 0 ] || die "No skus in remote DB — apply d1/schema.sql + d1/seed.sql first, then re-run."
ok "$SKU_COUNT skus present."

# --- 3. Optional: clear prior demo rows --------------------------------------
if [ "${RESET_FIRST:-0}" = "1" ]; then
  say "Clearing existing demo_order_% rows…"
  wr d1 execute "$DB_NAME" --remote --file=d1/reset-demo-orders.sql
  ok "Prior demo rows removed."
fi

# --- 4. Load the simulated orders --------------------------------------------
say "Loading simulated demo orders (d1/demo-orders-seed.sql)…"
wr d1 execute "$DB_NAME" --remote --file=d1/demo-orders-seed.sql
ok "Demo orders loaded."

# --- 5. Verify ---------------------------------------------------------------
say "Verifying…"
DEMO=$(wr d1 execute "$DB_NAME" --remote --json \
  --command "SELECT COUNT(*) AS n FROM orders WHERE id LIKE 'demo_order_%';" 2>/dev/null \
  | grep -oE '"n": *[0-9]+' | head -1 | grep -o '[0-9]*' || echo 0)
REAL=$(wr d1 execute "$DB_NAME" --remote --json \
  --command "SELECT COUNT(*) AS n FROM orders WHERE id NOT LIKE 'demo_order_%';" 2>/dev/null \
  | grep -oE '"n": *[0-9]+' | head -1 | grep -o '[0-9]*' || echo 0)
ok "Demo orders in DB: $DEMO"
ok "Real (non-demo) orders in DB: $REAL"
printf '\n\033[32m✅ UAT data ready. To wipe demo data later: RESET_FIRST=1 (or run d1/reset-demo-orders.sql --remote).\033[0m\n'
