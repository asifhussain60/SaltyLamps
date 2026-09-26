#!/usr/bin/env bash
# Deploy only to an already prepared, reconciled production environment.
# Infrastructure provisioning and migration adoption are explicit runbook steps.
# Required: PROD_CONFIG (defaults to wrangler.prod.toml), CLOUDFLARE_ACCOUNT_ID,
# CLOUDFLARE_API_TOKEN, and reviewed live payment/email/access configuration.
# Offline migration rehearsal: python3 scripts/plan-production-migrations.py --help
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

export PROD_CONFIG="${PROD_CONFIG-wrangler.prod.toml}"
export PROD_PROJECT="${PROD_PROJECT:-salty-lamps}"
export PROD_DB_NAME="${PROD_DB_NAME:-salty-lamps-db}"
export PROD_BUCKET="${PROD_BUCKET:-salty-lamps-images}"
BRANCH="${PROD_BRANCH:-master}"

# This gate is read-only. A missing ledger, pending migration, mismatched hash,
# failed query, empty catalog, missing resource or UAT target stops deployment.
# Never infer empty state from an error; never create/seed/replay behind this gate.
node scripts/production-preflight.mjs
if [ "${SEED_CATALOG:-0}" != "0" ]; then
  printf '%s\n' 'Catalog seeding during deployment is forbidden. Rehearse an empty-database bootstrap separately.' >&2
  exit 1
fi

# Both fetch and deployment use the selected production config/account/token.
# Live fetch failure stops the build even when a committed UAT snapshot exists.
export CONTENT_SNAPSHOT_PRODUCTION=1
export CONTENT_SNAPSHOT_SOURCE=live
npm run build

npx wrangler -c "$PROD_CONFIG" pages deploy dist \
  --project-name "$PROD_PROJECT" --branch "$BRANCH" --commit-dirty=true
printf '%s\n' 'Deployment completed. Verify live checkout, signed payment webhooks, protected admin, email delivery and rollback before changing customer DNS.'
