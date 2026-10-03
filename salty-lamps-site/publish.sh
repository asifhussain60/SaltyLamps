#!/usr/bin/env bash
# ./publish.sh test [--dry-run] | ./publish.sh sign-off --approved-by NAME --note NOTE --owner-accepted
# ./publish.sh live [--dry-run] [--push] | ./publish.sh snapshot
# Publishes tested code only. Development data never replaces live catalogue or orders.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
PY=""
for candidate in python3.13 python3.12 python3.11 python3; do
  if command -v "$candidate" >/dev/null && "$candidate" -c 'import tomllib' 2>/dev/null; then PY="$candidate"; break; fi
done
[ -n "$PY" ] || { echo 'Python 3.11 or newer is required.' >&2; exit 1; }
if [ "${1:-}" = snapshot ]; then shift; exec bash scripts/snapshot-live.sh "$@"; fi
exec "$PY" scripts/publish-release.py "$@"
