#!/usr/bin/env bash
# cloudflare-deploy.command
# Double-click this file in Finder to build + deploy to Cloudflare Pages.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="salty-lamps-proposal"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Salty Lamps — Cloudflare Pages Deploy          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

cd "$PROJECT_DIR"

# ── 1. Install wrangler locally if needed ─────────────────────────
echo "▶ Step 1/4 — Installing wrangler locally"
npm install --save-dev wrangler --silent
echo "  ✓  wrangler $(npx wrangler --version 2>/dev/null | head -1)"

# ── 2. Cloudflare login ───────────────────────────────────────────
echo ""
echo "▶ Step 2/4 — Cloudflare login"
echo "  Your browser will open. Log in to Cloudflare and click Allow."
echo "  Come back here once the browser shows: 'You have granted authorization'"
echo ""
npx wrangler login

# ── 3. Build the React app ────────────────────────────────────────
echo ""
echo "▶ Step 3/4 — Building React app"
npm run build
echo "  ✓  Build complete ($(du -sh dist | cut -f1))"

# ── 4. Deploy to Cloudflare Pages ────────────────────────────────
echo ""
echo "▶ Step 4/4 — Deploying to Cloudflare Pages"
npx wrangler pages deploy dist \
  --project-name "$PROJECT_NAME" \
  --branch master

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅  DEPLOYED                                   ║"
echo "║                                                  ║"
echo "║   Live URL:                                      ║"
echo "║   https://salty-lamps-proposal.pages.dev         ║"
echo "║                                                  ║"
echo "║   Dashboard:                                     ║"
echo "║   https://dash.cloudflare.com/pages              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Press any key to close this window..."
read -n 1
