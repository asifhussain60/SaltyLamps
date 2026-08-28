#!/usr/bin/env bash
# backup-cloudflare.sh — take a copy of everything the shop keeps on Cloudflare.
#
# WHY THIS EXISTS. The only D1 export in this repo was a side-effect of
# uat-refresh.sh, taken because that script was about to load demo data. There was
# no way to simply back up the shop, and nothing at all backed up R2 — where every
# product photograph the owner has uploaded through the admin lives. Losing that
# bucket means re-photographing the catalogue.
#
# WHAT IT SAVES, into d1/backups/<timestamp>/:
#
#   database.sql     the whole D1 database as SQL: catalogue, orders, order lines,
#                    settings, email templates and their outbox, enquiries, the
#                    audit log — everything
#   images/          every object in the R2 bucket, at full size
#   manifest.txt     what was taken, from which account, and the row counts, so a
#                    truncated backup is obvious rather than discovered later
#
# WHY IT COUNTS ROWS. A failed export can still leave a file behind. A backup
# nobody has read is a guess, so this reads its own output back and prints what is
# in it. If those numbers look wrong, the backup is wrong — check before relying on
# it, not after.
#
# TIME TRAVEL IS NOT A SUBSTITUTE. D1 keeps its own 30-day point-in-time history
# and it is excellent, but it lives inside the same account and the same database.
# It cannot help with an account being closed, a database being deleted, or a
# migration going somewhere unexpected — which is the whole reason this runs before
# any of that.
#
# USAGE
#   ./scripts/backup-cloudflare.sh                 # dev/UAT (wrangler.toml)
#   ./scripts/backup-cloudflare.sh --prod          # production (wrangler.prod.toml)
#   ./scripts/backup-cloudflare.sh --no-images     # database only, much faster
#
# AUTH. Needs a token that can read D1 and R2 — the Pages-only deploy token is not
# enough and fails with 7403 or 10000. Export CLOUDFLARE_API_TOKEN and
# CLOUDFLARE_ACCOUNT_ID, or be logged in with `npx wrangler login` to the right
# account. It only ever reads.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

CONFIG="wrangler.toml"
WITH_IMAGES=1
for arg in "$@"; do
  case "$arg" in
    --prod) CONFIG="wrangler.prod.toml" ;;
    --no-images) WITH_IMAGES=0 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

DB_NAME="${DB_NAME:-salty-lamps-db}"
BUCKET="${BUCKET:-salty-lamps-images}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="d1/backups/${STAMP}"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*"; }
die() { printf '\n\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }
wr()  { npx wrangler -c "$CONFIG" "$@"; }

[ -f "$CONFIG" ] || die "$CONFIG not found. Run this from salty-lamps-site/."

say "Backing up '$DB_NAME' via $CONFIG → $OUT/"
mkdir -p "$OUT"

# --- 1. the database ---------------------------------------------------------
say "Exporting the database"
wr d1 export "$DB_NAME" --remote --output="$OUT/database.sql" \
  || die "Export failed. Usually the token cannot read D1 — see the AUTH note at the top of this file."
[ -s "$OUT/database.sql" ] || die "The export produced an empty file. Do not treat this as a backup."
ok "database.sql ($(du -h "$OUT/database.sql" | cut -f1))"

# --- 2. read it back ---------------------------------------------------------
# Counting INSERTs in the dump rather than querying the live database on purpose:
# this measures what was actually WRITTEN TO DISK, which is the thing being relied
# on. A live query would confirm the database is fine while the file is truncated.
say "Reading the backup back"
count_rows() {
  local table="$1"
  grep -c "^INSERT INTO \"\\?${table}\"\\? " "$OUT/database.sql" 2>/dev/null || true
}
{
  printf 'Salty Lamps Cloudflare backup\n'
  printf 'taken       %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'config      %s\n' "$CONFIG"
  printf 'database    %s\n' "$DB_NAME"
  printf 'bucket      %s\n' "$BUCKET"
  printf 'account     %s\n' "${CLOUDFLARE_ACCOUNT_ID:-<from wrangler login>}"
  printf '\ninsert statements per table (as written to database.sql):\n'
  for t in products skus orders order_items categories settings email_templates email_outbox enquiries reviews product_images admin_audit; do
    printf '  %-18s %s\n' "$t" "$(count_rows "$t")"
  done
} > "$OUT/manifest.txt"
sed -n '8,30p' "$OUT/manifest.txt"

ORDERS="$(count_rows orders)"
PRODUCTS="$(count_rows products)"
[ "${PRODUCTS:-0}" -gt 0 ] || warn "No product rows in the dump. If this database should have a catalogue, STOP and investigate."
ok "manifest.txt written"

# --- 3. the images -----------------------------------------------------------
if [ "$WITH_IMAGES" -eq 1 ]; then
  say "Copying the image bucket"
  mkdir -p "$OUT/images"
  if KEYS="$(wr r2 object list "$BUCKET" --remote 2>/dev/null)"; then
    printf '%s\n' "$KEYS" > "$OUT/images/_listing.json"
    # The listing is JSON; pull out the keys without assuming jq is installed,
    # because it is not on a stock Mac.
    # A plain while-read rather than `mapfile`, which is bash 4 and therefore absent
    # from the bash macOS still ships. This script has to run on the owner's Mac.
    node -e '
      const fs = require("fs")
      const raw = fs.readFileSync(process.argv[1], "utf8")
      const start = raw.indexOf("[") >= 0 ? raw.slice(raw.indexOf("[")) : "[]"
      try {
        for (const o of JSON.parse(start)) if (o && o.key) console.log(o.key)
      } catch { /* an unparseable listing means zero objects, handled below */ }
    ' "$OUT/images/_listing.json" > "$OUT/images/_keys.txt"

    if [ ! -s "$OUT/images/_keys.txt" ]; then
      warn "The bucket lists no objects. That is correct for a fresh production account."
    else
      while IFS= read -r key; do
        [ -n "$key" ] || continue
        safe="$(printf '%s' "$key" | tr '/' '_')"
        wr r2 object get "$BUCKET/$key" --remote --file "$OUT/images/$safe" >/dev/null 2>&1 \
          || warn "could not fetch $key"
      done < "$OUT/images/_keys.txt"
      ok "$(find "$OUT/images" -type f ! -name '_listing.json' ! -name '_keys.txt' | wc -l | tr -d ' ') object(s) saved"
    fi
  else
    warn "Could not list the bucket. The token may not have R2 read, or R2 is not enabled on this account."
    warn "The database backup above is unaffected and still valid."
  fi
else
  warn "Skipping images (--no-images)"
fi

# --- 4. say plainly what happened -------------------------------------------
say "Done"
printf '  %s\n' "$OUT"
printf '  %s order row(s), %s product row(s)\n' "${ORDERS:-0}" "${PRODUCTS:-0}"
cat <<'NOTE'

  This folder is gitignored and contains real customer names, addresses and email
  addresses. Keep it somewhere private, and do not commit it or email it.

  To restore into an empty database:
    npx wrangler -c <config> d1 execute <db> --remote --file=<this folder>/database.sql
  Restoring over a database that already has rows will fail on duplicate keys —
  which is deliberate. Restore into an empty one.
NOTE
