# cv-manager Improvements — 4 Features

## Context
After navigation simplification (55→9 menu items, localStorage→API, split monoliths), implementing 4 new features across cv-pipeline, cv-api, and cv-manager.

## Features

### 1. OpenAPI cv-api Completion
- cv-api OpenAPI spec currently documents 13/25+ endpoints
- Missing: notes CRUD, file preview, search, dashboard, stats, sessions, API keys, SSE/WS streaming, backup/restore, tags, ATS scores, preferences, action history
- Goal: Complete spec to 100% endpoint coverage

### 2. Job Matching AI
- AI-powered compatibility score between CV and job posting
- Runs before tailoring — filters out non-relevant offers
- Score 0-100 with breakdown: skills match, experience level, location/remote, salary range, culture fit
- cv-pipeline: new `job-match.py` script
- cv-api: new endpoint `POST /api/applications/{name}/match`
- cv-manager: new UI card in application detail + batch scoring

### 3. RSS Job Discovery
- Aggregate RSS feeds from job boards into dashboard
- Sources: RemoteOK, WeWorkRemotely, HN Jobs, AngelList, Glassdoor RSS
- Filter by keywords, location, salary
- cv-manager: new "Job Discovery" section in dashboard with feed reader
- cv-pipeline: RSS feed aggregation script

### 4. PDF/A Accessibility
- Make PDFs WCAG compliant for ATS that parse poorly
- Tagged PDF structure, alt text for icons, reading order, language metadata
- cv-pipeline: render.py PDF/A support with accessibility tags
- cv-manager: PDF/A toggle in settings

## Sprints

### Sprint 1: OpenAPI cv-api Completion
- [ ] Read existing `docs/openapi.yml` (857 lines, 13 paths)
- [ ] Add missing endpoints: notes, preview, search, dashboard, stats, sessions, api-keys, stream, backup, restore, tags, ats-scores, preferences, action-history
- [ ] Add schemas for all request/response types
- [ ] Validate with OpenAPI validator
- [ ] Update README with complete endpoint list

### Sprint 2: Job Matching AI (cv-pipeline)
- [ ] Create `scripts/job-match.py` — AI-powered CV ↔ job compatibility scoring
- [ ] Score breakdown: skills (40%), experience (20%), location/remote (15%), salary (15%), culture (10%)
- [ ] Output JSON with overall score + per-category scores + missing keywords + red flags
- [ ] Add `make match NAME=...` target to Makefile
- [ ] Add tests for job-match.py
- [ ] Integrate with existing ATS scoring (complementary, not replacement)

### Sprint 3: Job Matching AI (cv-api + cv-manager)
- [ ] cv-api: Add `POST /api/applications/{name}/match` endpoint
- [ ] cv-api: Add `GET /api/applications/{name}/match` for cached results
- [ ] cv-manager: Add "Job Match Score" card to application detail page
- [ ] cv-manager: Add batch job matching from applications list
- [ ] cv-manager: Add match score filter/sort in applications table

### Sprint 4: RSS Job Discovery
- [ ] Create `scripts/rss-discovery.py` — aggregate RSS feeds from job boards
- [ ] Add `make rss-discover` target to Makefile
- [ ] cv-manager: Add "Job Discovery" section to dashboard with feed reader
- [ ] cv-manager: Add keyword filtering, save searches, bookmark jobs
- [ ] cv-manager: Add "Add to Pipeline" button (creates new application)

### Sprint 5: PDF/A Accessibility
- [ ] Update `scripts/render.py` to generate tagged PDF structure
- [ ] Add language metadata, reading order, alt text for icons
- [ ] Add `make pdfa` target — compile with PDF/A-2b compliance
- [ ] Add `make check-pdfa` — validate PDF/A compliance
- [ ] cv-manager: Add PDF/A toggle in settings
- [ ] cv-api: Add PDF/A variant to preview endpoint
- [ ] Tests: verify PDF/A compliance with validation tools

## Dependencies
Sprint 1 is independent
Sprint 2 → Sprint 3 (pipeline script before API/UI)
Sprint 4 is independent
Sprint 5 is independent

## Batch Plan
**Batch 1 (parallel):** Sprint 1 + Sprint 2 + Sprint 4 + Sprint 5
**Batch 2 (sequential, depends on Batch 1):** Sprint 3

## Execution Config
```bash
# cv-pipeline
make                          # Build master CV + Cover Letter
make check                    # All validations
make test                     # Run pytest

# cv-api
go build ./...                # Build
go test ./...                 # Test

# cv-manager
pnpm build                    # Next.js build
pnpm lint                     # ESLint
pnpm lint --fix               # ESLint fix
npx tsc --noEmit              # Type check
pnpm test                     # Vitest
pnpm dev                      # Dev server (port 3000)
pkill -f "next dev" || true   # Kill
```
