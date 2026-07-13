# Extension Submission Guide

This document explains how to package and submit CV Pipeline to the Chrome Web Store and Firefox Add-ons (AMO).

## Prerequisites

Before submitting:

- [ ] Icons are final art (not placeholders) — see store/listing.md
- [ ] At least 1 screenshot per store — see store/listing.md
- [ ] Privacy policy URL is reachable (required by both stores)
- [ ] Developer account on each store (one-time $5 fee for Chrome, free for Firefox)
- [ ] Source code ZIP for Firefox AMO (required for minified bundles — see Step 3)

## Step 1 — Build and package

Run:

    pnpm package

This command:
1. Runs a full production build (pnpm build internally)
2. Creates two versioned ZIP files in dist/packages/:
   - cv-extension-chrome-vX.Y.Z.zip — for Chrome Web Store
   - cv-extension-firefox-vX.Y.Z.zip — for Firefox AMO

The version is read from src/manifest.json.

## Step 2 — Chrome Web Store

### Account setup (once)

1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay the one-time $5 developer registration fee

### Submission

1. Click "Add new item" in the Developer Dashboard
2. Upload dist/packages/cv-extension-chrome-vX.Y.Z.zip
3. Fill in the store listing — copy name, descriptions, and permission justifications from store/listing.md
4. Upload icon images (128x128 required)
5. Upload at least 1 screenshot (1280x800 or 640x400)
6. In the Privacy tab: set the Privacy Policy URL (host store/privacy.md content at a reachable URL) and answer the data usage questionnaire (no user data collected by the extension itself)
7. Set distribution: All regions or restrict as needed
8. Click "Submit for review"

Review time: typically 1-7 business days for new submissions.

### Updates

1. Bump version in src/manifest.json
2. Run pnpm package
3. Upload the new ZIP in Developer Dashboard > your extension > Package tab

## Step 3 — Firefox Add-ons (AMO)

### Account setup (once)

1. Go to https://addons.mozilla.org/en-US/developers/
2. Create or sign in with a Firefox account (free)

### Firefox compatibility note

The extension background service worker uses "type": "module", which Firefox supports from version 128 onwards. Update src/manifest.json before submitting:

    "browser_specific_settings": {
      "gecko": {
        "id": "cv-pipeline@extension",
        "strict_min_version": "128.0"
      }
    }

### Source code requirement

Firefox AMO requires source code submission for extensions that use a build tool with minification. Create a source archive:

    git archive --format=zip HEAD -o dist/packages/cv-extension-source.zip

You will upload this in the AMO submission form alongside the extension ZIP.

Describe the build to AMO reviewers:

    Build tool: Vite 6 with @vitejs/plugin-react
    Node version: 20+, pnpm 9+
    Build command: pnpm install --frozen-lockfile && pnpm build
    Output directory: dist/

### Submission

1. Go to https://addons.mozilla.org/en-US/developers/addon/submit/
2. Choose "On this site" (publicly listed) or "By myself" (unlisted / self-distribution)
3. Upload dist/packages/cv-extension-firefox-vX.Y.Z.zip
4. When prompted, upload the source ZIP (cv-extension-source.zip)
5. Fill in the listing details — copy from store/listing.md
6. Add the Privacy Policy URL
7. Submit for review

Review time: typically 1-10 business days.

### Self-distribution (bypass store review)

1. Sign the extension via AMO: https://addons.mozilla.org/developers/addon/submit/ — choose "By myself"
2. Upload the Firefox ZIP — AMO signs it and returns an .xpi file
3. Distribute the signed .xpi directly

## CI/CD — Automated packaging on tag push

The repository includes .github/workflows/release.yml. On a version tag push:
1. Builds the extension
2. Creates Chrome and Firefox ZIPs
3. Creates a source archive for Firefox AMO
4. Attaches all three to a GitHub Release

Tag and push:

    git tag v0.1.0
    git push origin v0.1.0

Download the ZIPs from the GitHub Release page for manual store submission.

## Pre-submission checklist

- [ ] pnpm build passes with no errors
- [ ] pnpm test — all 92 tests pass
- [ ] pnpm lint — 0 errors
- [ ] Final icon art in public/icons/ (16, 48, 128 px)
- [ ] Screenshots captured (1280x800 or 640x400, at least 1 per store)
- [ ] Privacy policy hosted at a reachable URL
- [ ] Version in src/manifest.json matches intended release
- [ ] strict_min_version updated to 128.0 for Firefox
- [ ] pnpm package produces non-empty ZIPs in dist/packages/
- [ ] Source ZIP created: git archive --format=zip HEAD -o dist/packages/cv-extension-source.zip
- [ ] Chrome developer account active ($5 fee paid)
- [ ] Firefox developer account active (free)
