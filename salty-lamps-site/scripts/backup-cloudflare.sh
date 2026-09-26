#!/usr/bin/env bash
# Read-only Cloudflare backup with a local restore rehearsal and complete R2 copy.
# Usage: ./scripts/backup-cloudflare.sh [--prod] [--no-images]
# D1 needs a Cloudflare token with D1 Read access (or an authenticated Wrangler).
# Images additionally require CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and
# R2_SECRET_ACCESS_KEY: R2 S3 Object Read only, scoped to the chosen bucket.
# Quiesce writes for a cross-service consistent backup. Never restore over live data.
set -Eeuo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
CONFIG="wrangler.toml"
WITH_IMAGES=1
for arg in "$@"; do
  case "$arg" in
    --prod) CONFIG="${PROD_CONFIG:-wrangler.prod.toml}" ;;
    --no-images) WITH_IMAGES=0 ;;
    -h|--help) sed -n '2,7p' scripts/backup-cloudflare.sh; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done
DB_NAME="${DB_NAME:-salty-lamps-db}"
BUCKET="${BUCKET:-salty-lamps-images}"
[ -f "$CONFIG" ] || { printf '%s\n' 'Backup configuration is missing.' >&2; exit 1; }
if [ "$CONFIG" = 'wrangler.toml' ] || [ "${CLOUDFLARE_ACCOUNT_ID:-}" = '844bc687926c910d5ad9d79c40ad1f2f' ] || grep -Fq 'e8e40717-628d-481d-9175-e9c473620125' "$CONFIG"; then
  printf '%s\n' 'The former proposal Cloudflare account and database are retired. Select an approved owner-account target.' >&2
  exit 1
fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  printf '%s\n' 'An explicit approved Cloudflare account ID and API token are required for backup.' >&2
  exit 1
fi
if [ "$CLOUDFLARE_ACCOUNT_ID" != 'e35d5918c507bc2cf4e920fe38b5e318' ]; then
  printf '%s\n' 'Backups may target only the verified Salty Lamps owner account.' >&2
  exit 1
fi
if [ "$WITH_IMAGES" -eq 1 ]; then
  [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] && [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ] || {
    printf '%s\n' 'Full backup requires explicit R2 S3 credentials and account ID. Use --no-images only for a deliberate database-only backup.' >&2
    exit 1
  }
fi
mkdir -p d1/backups
OUT="$(mktemp -d "d1/backups/$(date +%Y%m%d-%H%M%S)-XXXXXX")"
trap 'printf "%s\n" "Backup failed. The incomplete folder must not be treated as a full backup." >&2' ERR
wr() { npx wrangler -c "$CONFIG" "$@"; }
printf '%s\n' 'Reading source table inventory and row counts…'
wr d1 execute "$DB_NAME" --remote --json --command "SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';" > "$OUT/tables.json"
QUERY="$(python3 scripts/cloudflare-backup.py count-query "$OUT/tables.json")"
SCHEMA_QUERY="SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND sql IS NOT NULL;"
wr d1 execute "$DB_NAME" --remote --json --command "$SCHEMA_QUERY" > "$OUT/schema-before.json"
wr d1 execute "$DB_NAME" --remote --json --command "$QUERY" > "$OUT/counts-before.json"
wr d1 export "$DB_NAME" --remote --output="$OUT/database.sql" > "$OUT/export.log" 2>&1
wr d1 execute "$DB_NAME" --remote --json --command "$QUERY" > "$OUT/counts-after.json"
wr d1 execute "$DB_NAME" --remote --json --command "$SCHEMA_QUERY" > "$OUT/schema-after.json"
python3 scripts/cloudflare-backup.py verify-database "$OUT"
if [ "$WITH_IMAGES" -eq 1 ]; then
  python3 scripts/cloudflare-backup.py images "$OUT" --bucket "$BUCKET"
  python3 scripts/cloudflare-backup.py finish "$OUT" --config "$CONFIG" --database "$DB_NAME"
  printf '%s\n' 'Complete database-and-images backup verified.'
else
  python3 scripts/cloudflare-backup.py finish-database-only "$OUT" --config "$CONFIG" --database "$DB_NAME"
  printf '%s\n' 'Database-only backup verified. Images were explicitly omitted.'
fi
printf 'Private backup folder: %s\n' "$OUT"
printf '%s\n' 'Keep this customer-data folder private. Inspect manifest.json and restore to an empty database only.'
