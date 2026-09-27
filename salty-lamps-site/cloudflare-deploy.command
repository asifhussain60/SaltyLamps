#!/usr/bin/env bash
# Retired double-click deploy shortcut. This formerly installed tooling,
# opened a Cloudflare login, and published to the prohibited proposal project.
# Keep a fail-closed stub so an old Finder shortcut cannot deploy by accident.
set -euo pipefail
printf '%s\n' 'Retired proposal deploy shortcut is disabled. Follow the reviewed Salty Lamps owner-account production procedure.' >&2
exit 1
