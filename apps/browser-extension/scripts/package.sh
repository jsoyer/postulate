#!/usr/bin/env bash
# scripts/package.sh
# Build and package the extension for Chrome and Firefox distribution.
#
# Usage:  pnpm package          (via package.json "package" script)
#         bash scripts/package.sh
#
# Output: dist/packages/cv-extension-chrome-vX.Y.Z.zip
#         dist/packages/cv-extension-firefox-vX.Y.Z.zip
#
# The script is idempotent: it always runs a fresh build and removes any
# previously generated packages before creating new ones.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

echo "[package] Running production build..."
pnpm build

# Extract version from the source manifest (single source of truth)
VERSION="$(node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('./src/manifest.json', 'utf8'));
  process.stdout.write(m.version);
")"
echo "[package] Version: v${VERSION}"

PACKAGES_DIR="dist/packages"
mkdir -p "$PACKAGES_DIR"

CHROME_ZIP="${PACKAGES_DIR}/cv-extension-chrome-v${VERSION}.zip"
FIREFOX_ZIP="${PACKAGES_DIR}/cv-extension-firefox-v${VERSION}.zip"

# Remove any previously built packages for this or other versions
rm -f "${PACKAGES_DIR}"/*.zip

echo "[package] Creating Chrome package..."
# Zip from inside dist/ so that paths inside the ZIP are relative (manifest.json at
# root, not dist/manifest.json). Exclude the packages/ subdirectory to avoid
# recursive inclusion.
(cd dist && zip -qr "../${CHROME_ZIP}" . --exclude "packages/*")

echo "[package] Creating Firefox package..."
# The same build is compatible with Firefox 128+ (MV3 service_worker + type:module).
# For Firefox AMO, you must also upload the source code when submitting — see SUBMISSION.md.
(cd dist && zip -qr "../${FIREFOX_ZIP}" . --exclude "packages/*")

CHROME_SIZE="$(du -sh "${CHROME_ZIP}" | cut -f1)"
FIREFOX_SIZE="$(du -sh "${FIREFOX_ZIP}" | cut -f1)"

echo ""
echo "[package] Packages ready in dist/packages/"
echo "  Chrome:  ${CHROME_ZIP} (${CHROME_SIZE})"
echo "  Firefox: ${FIREFOX_ZIP} (${FIREFOX_SIZE})"
