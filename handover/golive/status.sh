#!/usr/bin/env bash
# Read-only go-live status for the Salty Lamps shop. Changes nothing, prints no secret values.
#   ./handover/golive/status.sh        (from the repo root, or from anywhere)
# Needs `npx wrangler login` done as the owner or the approved Gmail administrator.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../salty-lamps-site"
export CLOUDFLARE_ACCOUNT_ID=e35d5918c507bc2cf4e920fe38b5e318
say() { printf '\n== %s\n' "$*"; }

say "Repo"
git log --oneline -1
echo "branch: $(git branch --show-current)   uncommitted files: $(git status --short | wc -l | tr -d ' ')"

say "Price snapshot age (the live release refuses over 24 hours)"
node -e "const s=JSON.parse(require('fs').readFileSync('src/content/content-snapshot.json','utf8'));const t=s.verifiedAt||s.generatedAt;console.log('read from',s.resolvedFrom,'at',t,'=',Math.round((Date.now()-new Date(t))/36e5),'hours ago')"

say "Secret names on salty-lamps-staging (values are never shown)"
npx wrangler pages secret list --project-name salty-lamps-staging 2>&1 | grep -E "STRIPE|RESEND|No secrets" || echo "(could not read; check the login)"

say "Pages projects and their domains"
npx wrangler pages project list 2>&1 | grep -E "salty-lamps" || echo "(could not read; check the login)"

say "Photo bucket"
npx wrangler r2 bucket list 2>&1 | grep -iE "^name" || echo "(could not read; check the login)"

say "Shop database: orders, notes, email settings"
npx wrangler -c wrangler.staging.toml d1 execute DB --remote --json --command "SELECT (SELECT COUNT(*) FROM orders WHERE id LIKE 'cs_test_%') AS test_orders, (SELECT COUNT(*) FROM orders WHERE id LIKE 'cs_live_%') AS live_orders, (SELECT COUNT(*) FROM orders WHERE special_instructions <> '') AS orders_with_notes, (SELECT group_concat(key || '=' || value, ' | ') FROM settings WHERE key IN ('email_enabled','admin_notify_email','email_from_address','public_contact_email','site_url')) AS email_settings" 2>&1 | grep -E "test_orders|live_orders|orders_with_notes|email_settings" || echo "(could not read; check the login)"

say "Migration log versus d1/migrations"
npx wrangler -c wrangler.staging.toml d1 execute DB --remote --json --command "SELECT name, sha256, status FROM production_migration_ledger" 2>/dev/null | node scripts/migration-ledger.mjs || echo "(migration check failed or could not read the database)"

printf '\nDone. Nothing was changed.\n'
