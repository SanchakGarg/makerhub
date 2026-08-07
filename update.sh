#!/usr/bin/env bash
set -e

echo ""
echo "  =================================="
echo "   MakerHub — Update"
echo "  =================================="
echo ""

# Check dependencies
if ! command -v docker &>/dev/null; then
  echo "  ERROR: Docker is not installed."
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "  ERROR: Git is not installed."
  exit 1
fi

echo "  [1/3] Stopping MakerHub..."
docker compose down

echo ""
echo "  [2/3] Pulling latest changes..."
git pull

echo ""
mkdir -p ./data

echo "  [3/3] Rebuilding and starting MakerHub..."
docker compose up --build -d

echo ""
echo "  =================================="
echo "   MakerHub updated and running!"

BASE_URL=$(grep -E '^BASE_URL=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
echo "   URL: ${BASE_URL:-http://localhost:${PORT:-3000}}"
echo "  =================================="
echo ""
