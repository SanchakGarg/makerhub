#!/usr/bin/env bash
# Runs a local dev server with admin auth bypassed, so you can look at the
# admin UI (Manage tab, Edit printer, New printer wizard) without a real
# Zitadel login. Picks a free port automatically. Ctrl+C stops it.
#
# NEVER set MAKERHUB_DEV_BYPASS_AUTH in a real deployment — it is only
# honored when NODE_ENV is not "production", which `next dev` guarantees,
# but there is no reason to ever put this in a real .env file.
set -e

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

echo ""
echo "  =================================================="
echo "   MakerHub — admin preview (auth bypassed, DEV ONLY)"
echo "  =================================================="
echo ""
echo "   URL: http://localhost:${PORT}"
echo "   Ctrl+C to stop."
echo ""

export MAKERHUB_DEV_BYPASS_AUTH=1
export BASE_URL="http://localhost:${PORT}"

exec npx next dev -p "$PORT"
