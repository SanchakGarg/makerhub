#!/usr/bin/env bash
set -e

echo ""
echo "  =================================="
echo "   MakerHub — Install"
echo "  =================================="
echo ""

# Check dependencies
if ! command -v docker &>/dev/null; then
  echo "  ERROR: Docker is not installed. Please install Docker first."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "  ERROR: Docker Compose is not available. Please install Docker Compose."
  exit 1
fi

mkdir -p ./data

# Copy .env if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example"
else
  echo "  .env already exists — skipping copy"
fi

echo ""
echo "  Opening .env for editing..."
echo "  Set BASE_URL to the IP/hostname of this machine, then save and close."
echo ""
read -rp "  Press Enter to open the editor..."

# Open in editor — prefer nano, fall back to vi
${EDITOR:-nano} .env

echo ""
echo "  Building and starting MakerHub..."
echo ""

docker compose up --build -d

echo ""
echo "  =================================="
echo "   MakerHub is running!"
echo ""

# Extract port from .env for display
PORT=$(grep -E '^PORT=' .env | cut -d= -f2 | tr -d '[:space:]')
BASE_URL=$(grep -E '^BASE_URL=' .env | cut -d= -f2 | tr -d '[:space:]')
echo "   URL: ${BASE_URL:-http://localhost:${PORT:-3000}}"
echo "  =================================="
echo ""
