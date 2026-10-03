#!/usr/bin/env bash
# Private recovery snapshot of the promoted live shop. Reads only, restores locally.
set -Eeuo pipefail
umask 077
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ "$CLOUDFLARE_ACCOUNT_ID" = e35d5918c507bc2cf4e920fe38b5e318 ] || {
  echo 'Unexpected Cloudflare account in shell.' >&2; exit 1;
}
export CLOUDFLARE_ACCOUNT_ID=e35d5918c507bc2cf4e920fe38b5e318
OUT="${1:-$HOME/salty-lamps-private/live-snapshot-$(date -u +%Y%m%dT%H%M%SZ)}"
case "$OUT" in "$(git rev-parse --show-toplevel)"*) echo 'Snapshot must be outside the repository.' >&2; exit 1;; esac
PY=""
for candidate in python3.13 python3.12 python3.11 python3; do
  if command -v "$candidate" >/dev/null && "$candidate" -c 'import tomllib' 2>/dev/null; then PY="$candidate"; break; fi
done
[ -n "$PY" ] || { echo 'Python 3.11 or newer is required.' >&2; exit 1; }
"$PY" scripts/live-preflight.py
"$PY" - "$OUT" <<'PY'
from pathlib import Path
import sys
folder=Path(sys.argv[1]).resolve()
repository=Path.cwd().parent.resolve()
if folder == repository or repository in folder.parents:
    sys.exit('Snapshot must be outside the repository.')
PY
mkdir -p "$OUT"
chmod 700 "$OUT"
[ ! -e "$OUT/database.sql" ] || { echo 'Use a new snapshot folder.' >&2; exit 1; }
wr() { ./node_modules/.bin/wrangler -c wrangler.live.toml "$@"; }
"$PY" scripts/cloudflare-owner.py /accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/salty-lamps-staging "$OUT/live-project.json"
wr d1 time-travel info DB --json > "$OUT/time-travel-before.json"
wr d1 execute DB --remote --json --command "SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';" > "$OUT/tables.json"
QUERY="$("$PY" scripts/cloudflare-backup.py count-query "$OUT/tables.json")"
SCHEMA="SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND sql IS NOT NULL;"
wr d1 execute DB --remote --json --command "$SCHEMA" > "$OUT/schema-before.json"
wr d1 execute DB --remote --json --command "$QUERY" > "$OUT/counts-before.json"
wr d1 export DB --remote --output "$OUT/database.sql" > "$OUT/export.log" 2>&1
wr d1 execute DB --remote --json --command "$QUERY" > "$OUT/counts-after.json"
wr d1 execute DB --remote --json --command "$SCHEMA" > "$OUT/schema-after.json"
"$PY" scripts/cloudflare-backup.py verify-database "$OUT"
cp wrangler.live.toml "$OUT/wrangler.live.toml"
git archive HEAD | gzip > "$OUT/source-head.tar.gz"
git bundle create "$OUT/source.bundle" HEAD > "$OUT/bundle.log" 2>&1
git rev-parse HEAD > "$OUT/source-commit.txt"
"$PY" - "$OUT" <<'PY'
import json, pathlib, subprocess, sys
folder = pathlib.Path(sys.argv[1])
project = json.loads((folder/'live-project.json').read_text())
commit = project['canonical_deployment']['deployment_trigger']['metadata']['commit_hash']
subprocess.run(['git', 'cat-file', '-e', commit+'^{commit}'], check=True)
with (folder/'source-deployed.tar').open('wb') as stream:
    subprocess.run(['git', 'archive', commit], stdout=stream, check=True)
(folder/'source-deployed-commit.txt').write_text(commit+'\n')
PY
gzip "$OUT/source-deployed.tar"
"$PY" scripts/development-replica.py snapshot-images "$OUT"
"$PY" - "$OUT" <<'PY'
import hashlib, json, pathlib, sys
folder=pathlib.Path(sys.argv[1])
files={str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest()
       for p in folder.rglob('*') if p.is_file() and p.name != 'snapshot-manifest.json'}
(folder/'snapshot-manifest.json').write_text(json.dumps({'status':'verified','files':files},indent=2)+'\n')
PY
echo 'Complete private snapshot verified: database restore, images, source and hosting metadata.'
