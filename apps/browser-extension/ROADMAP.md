# Roadmap

Planned features and improvements for the CV Pipeline browser extension.

## Job Site Support

- [x] LinkedIn (`/jobs/view/*`)
- [x] Indeed (`/viewjob*`)
- [x] Welcome to the Jungle (`/companies/*/jobs/*`)
- [ ] **Glassdoor** — detect `/job-listing/*` and `/partner/jobListing.htm*`
- [ ] **Monster** — detect `/job-openings/*`
- [ ] **AngelList / Wellfound** — detect `/jobs/*/apply`
- [ ] **Hacker News "Who's Hiring"** — parse monthly thread and inject per-comment buttons
- [ ] **Remotive / Remote OK** — remote-first job boards

## Extraction

- [ ] **AI-powered extraction for unknown sites** — use the page's main text
  content and a local prompt to identify company, position, and description
  when no selector matches
- [ ] **Fallback heuristics** — JSON-LD (`application/ld+json`) job posting
  schema detection as a universal fallback
- [ ] **Salary extraction** — detect and store salary ranges when present in
  the job description

## In-page Overlays

- [ ] **Skills gap overlay** — after extracting the job description, fetch
  `/api/applications/{name}/skills-gap` and display a tooltip showing missing
  and matching keywords directly on the job page
- [ ] **Application status badge** — show whether this job URL has already
  been added to the pipeline (prevent duplicates)

## Application Workflow

- [ ] **Auto-fill application forms** — prefill form fields (name, email,
  LinkedIn URL) from cv-api settings on ATS platforms (Greenhouse, Lever,
  Workday)
- [ ] **Bulk import from saved job board lists** — parse LinkedIn "Saved Jobs"
  and Indeed "Saved Jobs" pages and import them all at once
- [ ] **Offline queue** — when cv-api is unreachable, save the job locally in
  `chrome.storage.local` and retry automatically on next connection

## UI / UX

- [ ] **Application tracking sidebar** — a slide-in panel showing the full
  pipeline status without leaving the job page
- [ ] **Context menu integration** — right-click any page to "Add current page
  to CV Pipeline" even without a detected job posting
- [ ] **Keyboard shortcut** — configurable shortcut (default: `Alt+Shift+P`)
  to trigger the pipeline from any tab
- [ ] **Dark mode** — honour system preference and options-page setting
- [ ] **Popup search** — search recent applications directly from the popup

## Notifications

- [ ] **Deadline reminders** — notify N days before application deadlines stored
  in cv-api
- [ ] **Interview prep integration** — when status changes to "interview",
  notify and open a dedicated prep checklist
- [ ] **Pipeline completion webhook listener** — receive a browser notification
  when the `tailor` or `generate-pdf` action completes (via cv-api webhook)

## Settings & Portability

- [ ] **Export / import settings** — download settings as JSON and restore on
  another browser or machine
- [ ] **Internationalization (i18n)** — support French (FR) and English (EN)
  UI strings, auto-detect from browser locale
- [ ] **Multiple API profiles** — switch between different cv-api instances
  (e.g., work vs. personal)

## Analytics

- [ ] **Analytics dashboard in popup** — chart of applications per job board,
  weekly application rate, and conversion funnel (applied → interview → offer)

## Distribution

- [ ] **Firefox / AMO support** — test and polish Firefox compatibility,
  submit to addons.mozilla.org
- [ ] **Chrome Web Store** — prepare store listing, screenshots, privacy policy,
  and submit for review
- [ ] **Safari Web Extension** — wrap with Xcode Safari Web Extension converter

## Developer Experience

- [ ] **Storybook for popup/options components** — isolated component
  development and visual regression testing
- [ ] **End-to-end tests with Playwright** — puppeteer-extension or
  `@playwright/test` with a Chrome extension fixture
- [ ] **Automated packaging script** — `pnpm pack:chrome` and
  `pnpm pack:firefox` to produce `.crx` / `.xpi` archives ready for upload
