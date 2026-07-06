#!/usr/bin/env bash
# deploy-cloudflare.sh — build + deploy this site to Cloudflare Pages.
#
# Two ways to authenticate:
#   1. Non-interactive (preferred for CI / hands-off):
#        export CLOUDFLARE_API_TOKEN=...   # token scoped to Pages:Edit for the
#        export CLOUDFLARE_ACCOUNT_ID=...  # account that owns the project
#        ./deploy-cloudflare.sh
#   2. Interactive (browser OAuth):
#        ./deploy-cloudflare.sh            # opens a browser to log in if needed
#
# The Pages project name and branch can be overridden via env if they ever
# change; defaults match wrangler.toml.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PROJECT="${CF_PAGES_PROJECT:-salty-lamps-proposal}"
BRANCH="${CF_PAGES_BRANCH:-master}"

echo "▶ Building (npm run build)…"
npm run build
echo "  ✓ dist ready ($(du -sh dist | cut -f1))"

deploy() {
  npx wrangler pages deploy dist \
    --project-name "$PROJECT" \
    --branch "$BRANCH" \
    --commit-dirty=true
}

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "▶ Deploying with CLOUDFLARE_API_TOKEN (non-interactive)…"
  deploy
else
  echo "▶ Deploying with current wrangler login…"
  if ! deploy; then
    echo ""
    echo "⚠ Deploy failed. The most common cause is being logged into a"
    echo "  Cloudflare account that does not contain the '$PROJECT' project."
    echo "  A browser will now open — sign into the account that OWNS"
    echo "  https://$PROJECT.pages.dev, then click Allow."
    echo ""
    npx wrangler logout >/dev/null 2>&1 || true
    npx wrangler login
    deploy
  fi
fi

echo ""
echo "✅ Deployed → https://$PROJECT.pages.dev"
