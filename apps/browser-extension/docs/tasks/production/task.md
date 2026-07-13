# cv-browser-extension — Production Readiness

## Context
Extension is scaffolded (v0.1.0, 2 commits) but never tested live. Architecture is solid but has critical gaps: dead offline retry code, no integration tests, missing icons, untested DOM selectors.

## Sprints

### Sprint 1: Manual Testing + DOM Selector Fixes
- [ ] Build extension (`pnpm build`)
- [ ] Load as unpacked in Chromium
- [ ] Test detection on LinkedIn jobs page
- [ ] Test detection on Indeed jobs page
- [ ] Test detection on WTTJ jobs page
- [ ] Test "Add to CV Pipeline" button injection
- [ ] Test extraction (company, position, description)
- [ ] Fix any broken DOM selectors
- [ ] Test full pipeline (create app → upload → tailor) if cv-api is running

### Sprint 2: Offline Retry Logic
- [ ] Implement pending jobs queue in service worker
- [ ] Add retry mechanism with exponential backoff
- [ ] Show pending jobs count in popup badge
- [ ] Add "Retry All" button in popup
- [ ] Test offline scenario (disconnect network, add job, reconnect)

### Sprint 3: Integration Tests + Icon Assets
- [ ] Add API client integration tests (mock server)
- [ ] Add service worker tests (pipeline flow)
- [ ] Add injector tests (button injection)
- [ ] Generate icon assets (16px, 48px, 128px)
- [ ] Add CSP headers to manifest
- [ ] Run `pnpm test:coverage` — target >70%

### Sprint 4: Firefox Compatibility + Polish
- [ ] Add `webextension-polyfill` for Firefox
- [ ] Test on Firefox
- [ ] Add debounce to rapid clicks
- [ ] Fix follow-up notification to handle multiple stale apps
- [ ] Add error recovery/rollback in pipeline
- [ ] Update README with setup instructions and screenshots

## Batch Plan
**Batch 1:** Sprint 1 (manual testing — sequential, needs browser)
**Batch 2:** Sprint 2 + Sprint 3 (parallel)
**Batch 3:** Sprint 4 (sequential, depends on 2+3)

## Execution Config
```bash
pnpm build          # Build extension
pnpm test           # Run Vitest tests
pnpm test:coverage  # Coverage report
```
