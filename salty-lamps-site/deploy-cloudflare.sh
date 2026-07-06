#!/usr/bin/env bash
# deploy-cloudflare.sh — build + deploy this site to Cloudflare Pages.
#
# Auth, in order of preference:
#   1. CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID already exported — used as-is.
#   2. macOS Keychain — this project's token+account id, saved once via:
#        security add-generic-password -s salty-lamps-proposal-cloudflare-token \
#          -a salty-lamps-proposal -w '<token>' -U
#        security add-generic-password -s salty-lamps-proposal-cloudflare-account-id \
#          -a salty-lamps-proposal -w '<account id>' -U
#      (already set up as of 2026-07-06; nothing to do on this machine).
#   3. Interactive browser OAuth, as a last resort.
#
# The Pages project name and branch can be overridden via env if they ever
# change; defaults match wrangler.toml.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PROJECT="${CF_PAGES_PROJECT:-salty-lamps-proposal}"
BRANCH="${CF_PAGES_BRANCH:-master}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && command -v security >/dev/null 2>&1; then
  kc_token="$(security find-generic-password -s "${PROJECT}-cloudflare-token" -w 2>/dev/null || true)"
  kc_account="$(security find-generic-password -s "${PROJECT}-cloudflare-account-id" -w 2>/dev/null || true)"
  if [ -n "$kc_token" ]; then
    export CLOUDFLARE_API_TOKEN="$kc_token"
    [ -n "$kc_account" ] && export CLOUDFLARE_ACCOUNT_ID="$kc_account"
    echo "▶ Using Cloudflare credentials from Keychain (${PROJECT}-cloudflare-token)"
  fi
fi

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
