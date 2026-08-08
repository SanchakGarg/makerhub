#!/usr/bin/env bash
# Runs a PRODUCTION build with admin auth bypassed, so you can look at the
# admin UI (Manage tab, Edit printer, New printer wizard) without a real
# Zitadel login. Picks a free port automatically. Ctrl+C stops it.
#
# Deliberately a production build, not `next dev`: dev mode's hot-reload
# relies on a WebSocket connection, and on some networks (firewalls/proxies
# that allow plain HTTP but block WS upgrades) that failing WebSocket has
# been observed to leave the client-side JS half-initialized, so clicks
# stop working even though the page renders. A production build has no
# such WebSocket and isn't affected.
#
# The bypass (MAKERHUB_DEV_BYPASS_AUTH) only takes effect when ZITADEL_ISSUER
# is unset (see lib/auth/dev-bypass.ts) — a real deployment always has that
# set, so this can't accidentally disable auth in production even if this
# variable ends up in a real .env file.
set -e

cd "$(dirname "${BASH_SOURCE[0]}")"

find_free_port() {
  local port
  for port in $(seq 4100 4200); do
    if ! (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      echo "$port"
      return 0
    fi
    exec 3>&- 2>/dev/null || true
  done
  return 1
}

PORT=$(find_free_port) || { echo "No free port found in 4100-4200"; exit 1; }

# Explicitly set to empty (not `unset`) — Next.js auto-loads .env/.env.local
# at build and runtime, and only fills in a var if it is completely absent
# from process.env. If this dev server has a real .env checked out (e.g. a
# copy of the production config), a plain `unset` would get silently
# refilled from that file, defeating the safety check in dev-bypass.ts. An
# explicit empty string is not "absent," so Next's loader leaves it alone.
export ZITADEL_ISSUER=
export ZITADEL_CLIENT_ID=
export MAKERHUB_DEV_BYPASS_AUTH=1
export BASE_URL="http://localhost:${PORT}"

echo ""
echo "  =================================================="
echo "   MakerHub — admin preview (auth bypassed, DEV ONLY)"
echo "  =================================================="
echo ""
echo "   Building (production mode, no hot-reload)..."
echo ""

npx next build

echo ""
echo "   URL: http://localhost:${PORT}"
echo "   Also reachable on this machine's LAN IP at the same port."
echo "   Ctrl+C to stop."
echo ""

exec npx next start -p "$PORT"
