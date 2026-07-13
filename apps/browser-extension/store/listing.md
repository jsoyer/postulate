# CV Pipeline — Store Listing

## Chrome Web Store

**Name:** CV Pipeline
**Short description (132 chars max):** Detect job postings on LinkedIn, Indeed, and Welcome to the Jungle and trigger your CV tailoring pipeline in one click.
**Category:** Productivity
**Language:** English

**Detailed description:**

CV Pipeline is a browser extension for developers and job seekers who self-host a CV tailoring pipeline via cv-api (https://github.com/jsoyer/cv-api).

When you browse a job posting on LinkedIn, Indeed, or Welcome to the Jungle, the extension:
1. Detects the job page automatically
2. Injects an "Add to Pipeline" button near the Apply button
3. Extracts the company name, position title, and full job description from the page
4. Creates an application entry in your configured cv-api instance
5. Uploads the job description and triggers the tailor action to generate a customised CV

Key features:
- One-click pipeline trigger from any supported job page
- Popup showing recent applications and API connection status
- Badge count showing active (applied) applications
- Follow-up reminders via browser notifications (7-day stale threshold)
- Offline queue: failed requests are retried automatically when the API comes back online
- Configurable API URL and API key — works with any cv-api deployment
- Cross-browser: Chrome and Firefox 128+

**Permissions justification (reviewers check this):**

| Permission | Why it is needed |
|---|---|
| activeTab | Read the current job page DOM to extract company, position, and description |
| storage | Store user settings (API URL, API key, preferences) and the offline job queue locally |
| notifications | Show pipeline progress toasts and follow-up reminders |
| alarms | Schedule periodic badge refresh, follow-up checks, and offline retry cycles |
| tabs | Query the active tab to forward pipeline progress messages to the content script |
| host_permissions: linkedin.com, indeed.com, welcometothejungle.com | Inject the content script and read job data only on the three supported job boards |

## Firefox Add-ons (AMO)

**Name:** CV Pipeline
**Short description (250 chars max):** Detect job postings on LinkedIn, Indeed, and Welcome to the Jungle and send them to your self-hosted CV tailoring pipeline in one click. Requires a running cv-api instance.
**Category:** Productivity

Use the same detailed description as Chrome above (AMO allows up to 4 000 characters).

## Required Store Assets

### Icons (present in public/icons/ as valid PNGs — placeholder art, must be replaced)

| File | Size | Status |
|---|---|---|
| public/icons/icon-16.png | 16x16 | Present — placeholder, replace with final art |
| public/icons/icon-48.png | 48x48 | Present — placeholder, replace with final art |
| public/icons/icon-128.png | 128x128 | Present — placeholder, replace with final art |

### Screenshots (MISSING — must be created before submission)

Chrome Web Store requires at least 1 screenshot, recommended 3-5:
- Minimum size: 1280x800 or 640x400 pixels
- Suggested shots:
  1. Extension popup showing recent applications
  2. Job page on LinkedIn with the injected "Add to Pipeline" button
  3. Options/Settings page
  4. Popup showing badge count and connection status

Firefox AMO requires at least 1 screenshot (min 500x375 px, max 7 MB).

### Promotional tile (Chrome only, optional but recommended)

- Small tile: 440x280 px
- Marquee tile: 1400x560 px
