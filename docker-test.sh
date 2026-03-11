#!/usr/bin/env bash
# =============================================================================
# S3 Portal — Local Production Build & Smoke Test
# =============================================================================
# Run this BEFORE publish.sh to verify the production image builds correctly
# and the app starts up cleanly — without needing a real database.
#
# Usage:
#   ./docker-test.sh
# =============================================================================

set -euo pipefail

IMAGE="s3-portal:local-test"

echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║      S3 Portal — Local Build Test      ║"
echo "  ╚════════════════════════════════════════╝"
echo ""

# ── Step 1: Build ─────────────────────────────────────────────────────────────
echo "🏗   Step 1/3 — Building production image..."
docker build --target production -t "$IMAGE" .
echo ""

# ── Image size ────────────────────────────────────────────────────────────────
SIZE=$(docker image inspect "$IMAGE" --format='{{.Size}}' | awk '{printf "%.0f MB", $1/1024/1024}')
echo "  Image size: $SIZE"
echo ""

# ── Step 2: Start container ───────────────────────────────────────────────────
echo "🚀  Step 2/3 — Starting container on port 3333..."
CID=$(docker run -d -p 3333:3000 \
  -e DATABASE_URL="postgresql://x:x@host.docker.internal:5432/x" \
  -e NEXTAUTH_SECRET="test-secret-min-32-characters-long!!" \
  -e NEXTAUTH_URL="http://localhost:3333" \
  -e ENCRYPTION_KEY="test-encryption-32-chars-padded!!" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3333" \
  -e NODE_ENV="production" \
  "$IMAGE")

echo "  Container ID: $CID"
echo ""

# ── Step 3: Health check ──────────────────────────────────────────────────────
echo "🩺  Step 3/3 — Waiting for server to start (20s)..."
sleep 20

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/health || echo "000")

echo ""
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
  # 503 is acceptable — DB isn't connected but the server started
  echo "  ✅  Server started (HTTP $HTTP_CODE)"
  echo "  ✅  Image is good — safe to publish."
elif [ "$HTTP_CODE" = "000" ]; then
  echo "  ⚠️   Server did not respond — check container logs:"
  echo "      docker logs $CID"
else
  echo "  ⚠️   Unexpected response: HTTP $HTTP_CODE"
  echo "      docker logs $CID"
fi

# ── Cleanup ───────────────────────────────────────────────────────────────────
echo ""
echo "🧹  Stopping test container..."
docker stop "$CID" >/dev/null
docker rm   "$CID" >/dev/null

echo ""
echo "  Done. Run ./publish.sh when ready to push."
echo ""
