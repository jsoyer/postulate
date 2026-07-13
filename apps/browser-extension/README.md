# cv-browser-extension

A Manifest V3 browser extension for Chrome and Firefox that detects job postings on LinkedIn, Indeed, and Welcome to the Jungle, then triggers the full tailoring pipeline via [cv-api](https://github.com/jsoyer/cv-api) with a single click.

## Features

- Detects job pages on LinkedIn, Indeed, and Welcome to the Jungle
- Injects an "Add to CV Pipeline" button near the Apply button
- Extracts company, position, and job description from the DOM
- Sends data to cv-api: creates the application, uploads the job description, and triggers the `tailor` Make target
- Popup showing recent applications and connection status
- Badge count showing active (applied) applications
- Follow-up reminders via browser notifications (notifies all stale apps, up to 3 per cycle)
- Options page for API URL, API key, and preferences
- Debounced button clicks to prevent duplicate pipeline runs
- Error recovery: failed pipeline runs mark applications as rejected instead of orphaning them
- Cross-browser compatibility (Chrome + Firefox)

## Tech stack

- Manifest V3 (Chrome + Firefox compatible)
- TypeScript (strict mode)
- React 18 for popup and options pages
- Tailwind CSS v4
- Vite + `@vitejs/plugin-react`
- Vitest for testing
- webextension-polyfill for Firefox compatibility

## Installation

### Chrome

1. Build the extension:
   ```bash
   pnpm install
   pnpm build
   ```
2. Open `chrome://extensions` in your browser
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `dist/` directory

### Firefox

1. Build the extension:
   ```bash
   pnpm install
   pnpm build
   ```
2. Open `about:debugging#/runtime/this-firefox` in your browser
3. Click **Load Temporary Add-on** and select any file inside the `dist/` directory
4. The extension will be loaded until Firefox is restarted

> **Note:** For a permanent Firefox installation, you'll need to package the extension as an `.xpi` file and submit it to AMO (addons.mozilla.org), or use enterprise policy deployment.

## Setup

1. After installing, click the extension icon and select **Settings** (or right-click the icon > Options)
2. Configure the following:

| Setting | Description | Example |
|---|---|---|
| cv-api URL | Base URL of your cv-api instance | `http://localhost:8080` |
| API Key | Value of the `X-API-Key` header configured in cv-api | `your-secret-key` |
| Badge count | Show number of active applications on the icon | Toggle on/off |
| Follow-up notifications | Notify after 7 days of no update | Toggle on/off |

3. Click **Test connection** to verify the API is reachable
4. Click **Save settings**

## Usage

1. Navigate to a job posting on LinkedIn, Indeed, or Welcome to the Jungle
2. Wait for the purple **"Add to Pipeline"** button to appear near the Apply button
3. Click the button to start the pipeline:
   - The extension extracts job data (company, position, description)
   - Creates an application in cv-api
   - Uploads the job description as a file
   - Triggers the `tailor` action to generate a customized CV
4. A toast notification shows the progress at each step
5. Check the popup to see recent applications and connection status

## Troubleshooting

### Button doesn't appear on job pages

- Make sure you're on a supported job page URL pattern
- Try refreshing the page — the extension waits up to 1.5s for lazy-loaded content
- Check that the extension is enabled in your browser's extension manager

### "API key not configured" warning

- Open the extension options and set your API URL and API key
- Click **Save settings**

### "Cannot reach cv-api" in popup

- Verify your cv-api instance is running at the configured URL
- Make sure the API key matches your cv-api configuration
- Check for CORS issues if cv-api is on a different domain

### Pipeline fails with an error

- Check the error message in the toast notification
- Verify your cv-api instance is running and healthy
- Ensure the API has the `tailor` target configured
- If the pipeline fails after creating an application, it will be marked as "rejected" automatically to prevent orphaned entries

### Rapid clicks still triggering multiple requests

- The button is debounced for 10 seconds. If you see "Already processing", wait a moment and try again

### Follow-up notifications not appearing

- Ensure "Follow-up notifications" is enabled in Settings
- Check that your browser allows notifications from the extension
- Notifications only trigger for applications older than 7 days with "applied" status
- Maximum 3 notifications per check cycle to avoid spam

## Development

```bash
pnpm dev          # Watch mode — rebuilds on file change
pnpm build        # Typecheck + build
pnpm build:only   # Skip typecheck (CI splits them)
pnpm test         # Run tests
pnpm test:watch   # Watch mode
pnpm lint         # Lint
pnpm format       # Format code
```

## Supported sites

| Site | URL pattern |
|---|---|
| LinkedIn | `linkedin.com/jobs/view/*` |
| Indeed | `indeed.com/viewjob*`, `indeed.com/rc/clk*` |
| Welcome to the Jungle | `welcometothejungle.com/*/companies/*/jobs/*` |

## Directory structure

```
src/
  background/       # Manifest V3 service worker
  content/          # Content scripts (detector, extractor, injector)
  popup/            # React popup UI
  options/          # React options page
  lib/              # Shared types, API client, storage helpers, constants, browser shim
  styles/           # Global CSS (Tailwind)
  manifest.json
tests/
  detector.test.ts
  extractor.test.ts
```

## License

MIT
