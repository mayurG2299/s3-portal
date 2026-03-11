#!/usr/bin/env bash
# =============================================================================
# S3 Portal — Docker Hub Publish Script
# =============================================================================
# Usage: ./publish.sh
# The script will prompt you for all required inputs.
# =============================================================================

set -euo pipefail

IMAGE_NAME="s3-portal"
PLATFORMS="linux/amd64,linux/arm64"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║       S3 Portal — Docker Publish       ║"
echo "  ╚════════════════════════════════════════╝"
echo ""

# ── Prompt: Docker Hub username ───────────────────────────────────────────────
while true; do
  read -rp "  Docker Hub username: " DOCKER_USER
  [ -n "$DOCKER_USER" ] && break
  echo "  ⚠️  Username cannot be empty. Try again."
done

# ── Prompt: Version tag ───────────────────────────────────────────────────────
read -rp "  Version tag (leave blank for :latest only): " VERSION
VERSION="${VERSION:-}"

# ── Confirm ───────────────────────────────────────────────────────────────────
FULL_IMAGE="$DOCKER_USER/$IMAGE_NAME"
echo ""
echo "  Image    : $FULL_IMAGE"
echo "  Tags     : :latest${VERSION:+, :$VERSION}"
echo "  Platforms: $PLATFORMS"
echo ""
read -rp "  Proceed? [y/N] " CONFIRM
echo ""
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }

# ── Login ─────────────────────────────────────────────────────────────────────
echo "🔐  Logging in to Docker Hub..."
docker login
echo ""

# ── Ensure buildx builder ─────────────────────────────────────────────────────
BUILDER="s3portal-builder"
if ! docker buildx inspect "$BUILDER" &>/dev/null; then
  echo "🔧  Creating multi-arch buildx builder..."
  docker buildx create --name "$BUILDER" --use --bootstrap
else
  docker buildx use "$BUILDER"
fi

# ── Build & Push ──────────────────────────────────────────────────────────────
TAG_ARGS="-t $FULL_IMAGE:latest"
[ -n "$VERSION" ] && TAG_ARGS="$TAG_ARGS -t $FULL_IMAGE:$VERSION"

echo "🏗   Building & pushing ($PLATFORMS)..."
echo ""
# shellcheck disable=SC2086
docker buildx build \
  --platform "$PLATFORMS" \
  --target production \
  $TAG_ARGS \
  --push \
  .

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ✅  Published successfully!"
echo ""
echo "  docker pull $FULL_IMAGE:latest"
[ -n "$VERSION" ] && echo "  docker pull $FULL_IMAGE:$VERSION"
echo ""
echo "  https://hub.docker.com/r/$FULL_IMAGE/tags"
echo ""

