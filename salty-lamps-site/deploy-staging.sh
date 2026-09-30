#!/usr/bin/env bash
# Publish a committed release to the PRIVATE owner-account test shop, and nothing else.
#
# Not for production: the target is pinned by wrangler.staging.toml and re-checked by
# scripts/staging-preflight.py (owner account, staging D1, no R2, Stripe test-only,
# mail dry-run). It never touches salty-lamps-db, the salty-lamps Pages project, DNS,
# Access, secrets, or the retired proposal account.
#
# Run it yourself, on a machine where `npx wrangler login` was completed as the Salty
# Lamps owner (Saltylamps@hotmail.com) or the approved Gmail administrator inside that
# account. Nothing here reads or stores a password, token or API key.
#
#   STAGING_DRY_RUN=1 ./deploy-staging.sh   # offline half only: no network, no login, no writes
#   ./deploy-staging.sh                     # full run; asks "yes" before every remote write
#   STAGING_CODE_ONLY=1 ./deploy-staging.sh # publish the code only; never touches the database (use once the owner is editing live)
#
# Optional: STAGING_BRANCH (default main) must be the staging project's production
# branch, or the custom hostname will not move to the new deployment.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

CONFIG=wrangler.staging.toml
PROJECT=salty-lamps-staging
OWNER_ACCOUNT=e35d5918c507bc2cf4e920fe38b5e318
RETIRED_ACCOUNT=844bc687926c910d5ad9d79c40ad1f2f
RETIRED_EMAIL=asifhussain60@hotmail.com
BRANCH="${STAGING_BRANCH:-main}"
DRY="${STAGING_DRY_RUN:-0}"
CODE_ONLY="${STAGING_CODE_ONLY:-0}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
# Outside the repository on purpose: the price-correction generator refuses paths inside it.
WORK="${STAGING_WORK_DIR:-$HOME/salty-lamps-private}/staging-$STAMP"

say()     { printf '\n== %s\n' "$*"; }
die()     { printf 'STOPPED: %s\n' "$*" >&2; exit 1; }
confirm() { printf '\n%s\nType yes to continue: ' "$1"; read -r reply; [ "$reply" = yes ] || die "declined; nothing further was changed."; }
wr()      { npx wrangler -c "$CONFIG" "$@"; }

say "1/8 Fail-closed target check (offline)"
python3 scripts/staging-preflight.py
[ -z "${CONTENT_SNAPSHOT_PRODUCTION:-}" ] || die "CONTENT_SNAPSHOT_PRODUCTION is set; this is not a production build."
[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ "$CLOUDFLARE_ACCOUNT_ID" = "$OWNER_ACCOUNT" ] || die "CLOUDFLARE_ACCOUNT_ID is not the owner account."
export CLOUDFLARE_ACCOUNT_ID="$OWNER_ACCOUNT"

say "2/8 Release identity (offline)"
git diff --quiet && git diff --cached --quiet || die "uncommitted changes; publish a real commit so the release can be traced."
COMMIT="$(git rev-parse HEAD)"
printf 'Releasing commit %s\n' "$COMMIT"

say "3/8 Build the test-shop bundle (offline)"
[ -d node_modules ] || npm ci
export CONTENT_SNAPSHOT_SOURCE=committed VITE_STAGING=1
npm run build
git diff --quiet -- src/content || die "the build changed the committed content snapshot; restore it and investigate."
# The pages' text, prices and structured data come from the committed snapshot, not the
# database. Warn (never block a code-only publish) when it was not read from the test shop
# database, or is over a day old, because search engines would then read stale prices.
node -e "
const s = JSON.parse(require('fs').readFileSync('src/content/content-snapshot.json', 'utf8'));
const hours = Math.round((Date.now() - new Date(s.generatedAt)) / 36e5);
if (s.resolvedFrom !== 'staging' || hours > 24) {
  console.log('WARNING: page prices and copy come from a snapshot read from \"' + s.resolvedFrom + '\" ' + hours + ' hours ago, not the test shop database.');
  console.log('         Before launch run: npm run content:refresh-staging, review the diff, commit it, then publish.');
}"

say "4/8 Prepare the guarded price correction (offline)"
umask 077
mkdir -p "$WORK"
python3 scripts/prepare-staging-price-correction.py "$WORK/price-correction.sql"
printf 'Working files: %s\n' "$WORK"

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

# This script always sets sandbox mode. Once www is attached to the project the shop is live
# and running it would put real checkout back into Stripe test mode and stop every uploaded
# photo being served, so refuse. Publish the live shop with ./deploy-live.sh instead.
set +e
npx wrangler pages project list --json 2>/dev/null | python3 scripts/pages-has-www.py "$PROJECT"
WWW_CHECK=$?
set -e
[ "$WWW_CHECK" != 0 ] || die "www.saltylamps.co.uk is attached to $PROJECT: the shop is live, and this script would switch it back to sandbox mode. Use ./deploy-live.sh."
[ "$WWW_CHECK" = 1 ] || die "could not tell whether the shop is live (project list unreadable); stopping rather than risk a sandbox deploy onto it."

say "6/8 Recovery point for the test database (read-only)"
wr d1 export DB --remote --output "$WORK/staging-before.sql"
wr d1 time-travel info DB --json > "$WORK/staging-time-travel-before.json"
printf 'Saved %s and a Time Travel bookmark. To roll back: wrangler d1 time-travel restore DB --bookmark=<value in staging-time-travel-before.json>\n' "$WORK/staging-before.sql"

say "7/8 Test database changes"
if [ "$CODE_ONLY" = 1 ]; then
  printf 'STAGING_CODE_ONLY=1: the database is not changed in this run.\n'
else
confirm "Create the image-storage tables in the PRIVATE TEST database salty-lamps-staging-db? (CREATE TABLE IF NOT EXISTS only)"
wr d1 execute DB --remote --file d1/staging/image-storage.sql
confirm "Apply the guarded price correction to salty-lamps-staging-db? Each UPDATE only fires where the price still equals the old demo value; edited prices are left alone."
wr d1 execute DB --remote --file "$WORK/price-correction.sql"
wr d1 execute DB --remote --json --command "SELECT product_id, variant_label, price_pence FROM skus" > "$WORK/skus-after.json"
python3 - "$WORK/skus-after.json" <<'PY'
import importlib.util, json, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location('prices', Path('scripts/prepare-staging-price-correction.py'))
prices = importlib.util.module_from_spec(spec); spec.loader.exec_module(prices)
text = Path(sys.argv[1]).read_text()
live = {(r['product_id'], r['variant_label']): r['price_pence'] for r in json.loads(text[text.index('['):])[0]['results']}
planned = prices.proposed_updates()
applied = sum(1 for p, l, old, new in planned if live.get((p, l)) == new)
kept = [(l, live.get((p, l))) for p, l, old, new in planned if live.get((p, l)) not in (new,)]
print(f'Read back {len(live)} options: {applied}/{len(planned)} corrections are now at the reviewed price.')
if kept:
    print('Left unchanged because they no longer held the old demo price:', kept)
sys.exit(0 if applied + len(kept) == len(planned) else 'Read-back does not account for every planned correction.')
PY

fi

say "8/8 Publish to the private test project"
confirm "Deploy commit ${COMMIT:0:7} to the Pages project $PROJECT on branch '$BRANCH'? The customer domain and production are not involved."
# Pages rejects -c/--config; it only reads ./wrangler.toml. The tracked wrangler.toml is the
# local-only placeholder, so set it aside, put the pinned staging config in its place for the
# length of the deploy, and restore the original on every exit path (including failure).
LOCAL_CFG="$WORK/wrangler.toml.local"
[ ! -e "$LOCAL_CFG" ] || die "$LOCAL_CFG already exists."
restore_config() { [ ! -e "$LOCAL_CFG" ] || mv -f "$LOCAL_CFG" wrangler.toml; }
mv wrangler.toml "$LOCAL_CFG"
trap restore_config EXIT
grep -v "^account_id" "$CONFIG" > wrangler.toml   # Pages rejects account_id; CLOUDFLARE_ACCOUNT_ID (owner) is exported above
npx wrangler pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" \
  --commit-hash "$COMMIT" --commit-message "private test release ${COMMIT:0:7}" --commit-dirty=false
restore_config

say "Published. Still to verify by hand, in Chrome, signed in through Cloudflare Access"
cat <<'EOF'
  1. https://admin.saltylamps.co.uk/admin/products  ->  open a product, upload a photo (under 2 MB), reload: it is still there.
  2. Reorder two photos with the arrows and by dragging; reload; the first photo is Primary.
  3. https://test.saltylamps.co.uk/shop  ->  that product's card shows the new primary photo.
  4. Culinary salt shows 3.99 / 11.99 / 16.99 pounds for 1 / 5 / 10 Kg, fine and coarse, in the shop picker AND the admin editor.
  5. Delete the test photo afterwards.
EOF
