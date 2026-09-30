#!/usr/bin/env bash
# Publish a committed release to the shop that goes LIVE in place: the Pages project
# salty-lamps-staging, configured by wrangler.live.toml (no sandbox switches, R2 bound,
# customer address). It is the only script that may turn the sandbox switches off.
#
# It does not attach www, create the holding rule, or change DNS, Access, Stripe or
# secrets; those are the owner's steps in docs/migration.md step 11. It never writes to
# the database. Run it yourself, on a machine where `npx wrangler login` was completed as
# the Salty Lamps owner (Saltylamps@hotmail.com) or the approved Gmail administrator
# inside that account. Nothing here reads or stores a password, token or API key.
#
#   LIVE_DRY_RUN=1 ./deploy-live.sh   # offline half only: no network, no login, no writes
#   ./deploy-live.sh                  # full run; reads the account, then asks you to type
#                                     # "deploy live" before the one remote write
#
# Order in the launch runbook: clear the sandbox records, enable R2, refresh the content
# snapshot (npm run content:refresh-staging, commit it), install the four secrets, THEN this.
# Pages binds secrets at deploy time, so this run is also what activates them.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

CONFIG=wrangler.live.toml
PROJECT=salty-lamps-staging
BUCKET=salty-lamps-images
OWNER_ACCOUNT=e35d5918c507bc2cf4e920fe38b5e318
RETIRED_ACCOUNT=844bc687926c910d5ad9d79c40ad1f2f
RETIRED_EMAIL=asifhussain60@hotmail.com
BRANCH="${LIVE_BRANCH:-main}"
DRY="${LIVE_DRY_RUN:-0}"
MAX_SNAPSHOT_HOURS="${LIVE_SNAPSHOT_MAX_HOURS:-24}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="${LIVE_WORK_DIR:-$HOME/salty-lamps-private}/live-$STAMP"

say()  { printf '\n== %s\n' "$*"; }
die()  { printf 'STOPPED: %s\n' "$*" >&2; exit 1; }
# Typing "yes" is too easy to do on autopilot for the change that turns real money on.
confirm_phrase() { printf '\n%s\nType "%s" to continue: ' "$1" "$2"; read -r reply; [ "$reply" = "$2" ] || die "declined; nothing further was changed."; }
wr()   { npx wrangler -c "$CONFIG" "$@"; }

say "1/8 Fail-closed target check (offline)"
python3 scripts/live-preflight.py
[ -z "${CONTENT_SNAPSHOT_PRODUCTION:-}" ] || die "CONTENT_SNAPSHOT_PRODUCTION is set; this is not a production-snapshot build."
[ -z "${VITE_STAGING:-}" ] || die "VITE_STAGING is set in this shell; it would put the test-shop banner on the live site."
[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ "$CLOUDFLARE_ACCOUNT_ID" = "$OWNER_ACCOUNT" ] || die "CLOUDFLARE_ACCOUNT_ID is not the owner account."
export CLOUDFLARE_ACCOUNT_ID="$OWNER_ACCOUNT"

say "2/8 Release identity and tests (offline)"
git diff --quiet && git diff --cached --quiet || die "uncommitted changes; publish a real commit so the release can be traced."
COMMIT="$(git rev-parse HEAD)"
printf 'Releasing commit %s\n' "$COMMIT"
[ -d node_modules ] || npm ci
npm run test:unit >/dev/null || die "the unit tests fail; a release with failing tests does not go live. Run: npm run test:unit"
printf 'Unit tests pass.\n'

say "3/8 Content snapshot must be fresh and read from the shop database (offline)"
# The pages carry prices, copy and structured data from the committed snapshot. The owner
# edits the database until the freeze, so a stale snapshot shows search engines old prices.
node -e "
const s = JSON.parse(require('fs').readFileSync('src/content/content-snapshot.json', 'utf8'));
const hours = Math.round((Date.now() - new Date(s.verifiedAt || s.generatedAt)) / 36e5);
if (s.resolvedFrom !== 'staging') { console.error('The snapshot was read from \"' + s.resolvedFrom + '\", not the shop database.'); process.exit(1); }
if (hours > Number(process.argv[1])) { console.error('The snapshot is ' + hours + ' hours old (limit ' + process.argv[1] + ').'); process.exit(1); }
console.log('Snapshot read from the shop database ' + hours + ' hours ago.');" "$MAX_SNAPSHOT_HOURS" \
  || die "refresh it: npm run content:refresh-staging, review the diff, commit it, then run this again."

say "4/8 Build the live bundle (offline)"
export CONTENT_SNAPSHOT_SOURCE=committed
unset VITE_STAGING
npm run build
git diff --quiet -- src/content || die "the build changed the committed content snapshot; restore it and investigate."
! grep -rIl "Stripe sandbox only" dist >/dev/null 2>&1 || die "the built site still carries the test-shop banner."
grep -q "^Sitemap: https://www.saltylamps.co.uk/sitemap.xml" dist/robots.txt || die "dist/robots.txt does not name the www sitemap."
printf 'Live bundle built: no test banner, sitemap points at www.\n'

if [ "$DRY" = 1 ]; then
  say "Dry run complete"
  printf 'Offline half passed. No login was used and nothing remote was read or written.\n'
  exit 0
fi

say "5/8 Confirm the Cloudflare login is the owner account"
WHO="$(npx wrangler whoami --json)" || die "not logged in. Run: npx wrangler login  (as the Salty Lamps owner)."
printf '%s' "$WHO" | RETIRED_EMAIL="$RETIRED_EMAIL" OWNER="$OWNER_ACCOUNT" RETIRED="$RETIRED_ACCOUNT" python3 -c '
import json, os, sys
text = sys.stdin.read()
who = json.loads(text[text.index("{"):])
email = (who.get("email") or "").lower()
ids = {a.get("id") for a in who.get("accounts", [])}
if email == os.environ["RETIRED_EMAIL"]: sys.exit("The retired identity is signed in. It is prohibited; log out and sign in as the owner.")
if os.environ["RETIRED"] in ids: sys.exit("The retired proposal account is reachable from this login. Stop and use the owner login.")
if os.environ["OWNER"] not in ids: sys.exit("This login is not a member of the Salty Lamps owner account.")
print("Signed in as", email or "(token)", "with access to the owner account.")
'

say "6/8 Account readiness (read-only)"
# R2 must be enabled and the bucket must exist, or every photo upload and /api/images
# address fails the moment the sandbox switches are removed.
BUCKETS="$(npx wrangler r2 bucket list 2>&1)" || die "R2 is not enabled on the owner account (enable it in the dashboard, accept its terms, then: npx wrangler r2 bucket create $BUCKET)."
printf '%s' "$BUCKETS" | grep -q "$BUCKET" || die "the R2 bucket $BUCKET does not exist. Create it: npx wrangler r2 bucket create $BUCKET"
printf 'R2 bucket %s exists.\n' "$BUCKET"
# Names only; Wrangler never prints the values. It cannot prove they are LIVE keys, which
# is what the real-payment dry run in step 11 is for.
SECRETS="$(npx wrangler pages secret list --project-name "$PROJECT" 2>&1)" || die "could not list the project secrets."
MISSING=""
for name in STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY; do
  printf '%s' "$SECRETS" | grep -q "$name" || MISSING="$MISSING $name"
done
[ -z "$MISSING" ] || die "these secrets are not set on $PROJECT:$MISSING. The owner sets each with: npx wrangler pages secret put NAME --project-name $PROJECT"
printf 'All four secrets are present by name. Their values were not read.\n'

say "7/8 Recovery point for the shop database (read-only)"
umask 077
mkdir -p "$WORK"
wr d1 export DB --remote --output "$WORK/live-before.sql"
wr d1 time-travel info DB --json > "$WORK/live-time-travel-before.json"
printf 'Saved %s and a Time Travel bookmark. To roll back: wrangler d1 time-travel restore DB --bookmark=<value in live-time-travel-before.json>\n' "$WORK/live-before.sql"
STRANDED="$(wr d1 execute DB --remote --json --command "SELECT COUNT(*) AS n FROM staging_image_objects" 2>/dev/null | python3 -c 'import sys,json; t=sys.stdin.read(); print(json.loads(t[t.index("["):])[0]["results"][0]["n"])' 2>/dev/null || echo unknown)"
printf 'Photos still stored in the temporary test-database storage: %s. They stop being served once this release is live; copy or re-upload them to R2 before www is opened to the public.\n' "$STRANDED"

say "8/8 Publish the live configuration to $PROJECT"
confirm_phrase "This deploys commit ${COMMIT:0:7} to $PROJECT with the SANDBOX SWITCHES OFF: live Stripe keys are accepted, email can send, photos use R2. The test and admin hostnames stay behind sign-in and www is not attached by this step. The database is not changed." "deploy live"
# Pages rejects -c/--config; it only reads ./wrangler.toml. Set the tracked placeholder
# aside, put the pinned live config in its place for the length of the deploy, and restore
# it on every exit path.
LOCAL_CFG="$WORK/wrangler.toml.local"
[ ! -e "$LOCAL_CFG" ] || die "$LOCAL_CFG already exists."
restore_config() { [ ! -e "$LOCAL_CFG" ] || mv -f "$LOCAL_CFG" wrangler.toml; }
mv wrangler.toml "$LOCAL_CFG"
trap restore_config EXIT
grep -v "^account_id" "$CONFIG" > wrangler.toml   # Pages rejects account_id; CLOUDFLARE_ACCOUNT_ID (owner) is exported above
npx wrangler pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" \
  --commit-hash "$COMMIT" --commit-message "live release ${COMMIT:0:7}" --commit-dirty=false
restore_config

say "Published. Next, in docs/migration.md step 11"
cat <<'EOF'
  1. Signed in at https://admin.saltylamps.co.uk/admin, upload a photo to a product and reload: it is stored in R2.
  2. Copy or re-upload the photos listed above, then check every product image address returns 200.
  3. Create the temporary www rule, attach www to this project, then run the owner-present email test
     and the real-payment dry run. Only then lift the rule.
  If this release misbehaves before www is attached: ./deploy-staging.sh (code-only) puts the sandbox back.
  After www is attached, roll back from Cloudflare Pages > salty-lamps-staging > Deployments.
EOF
