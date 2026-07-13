# CV Manager — Navigation & Workflow Simplification

## Context

cv-manager has 56 sidebar menu items across 9 sections, 55 near-identical `/actions/*` pages, monolithic components (Settings 1243 lines, Applications 1119 lines), and too much state in localStorage. The goal is to simplify navigation, make actions contextual, and clean up the codebase.

## Acceptance Criteria

- [ ] Sidebar reduced to ≤ 12 top-level items
- [ ] All 55 action pages replaced by single dynamic `/actions/[target]` page
- [ ] Actions accessible contextually from application detail page
- [ ] Settings page split into component files (≤ 200 lines each)
- [ ] Applications page split into component files (≤ 200 lines each)
- [ ] All routes return HTTP 200
- [ ] All existing tests pass
- [ ] No console errors in browser
- [ ] No regression in functionality (all actions still runnable)

## Sprints

### Sprint 1: Collapse Actions into Dynamic Page

**Goal:** Replace 55 `/actions/*` pages with one `/actions/[target]/page.tsx`

- [ ] Read existing action page structure to understand ActionRunner config pattern
- [ ] Create `/actions/[target]/page.tsx` that reads target metadata and renders ActionRunner
- [ ] Create action registry/config that maps target names to their form fields, descriptions, categories
- [ ] Create `/actions/page.tsx` as a categorized grid/searchable list of all actions
- [ ] Delete all 55 individual action directories (keep their config in the registry)
- [ ] Update sidebar to have single "Actions" item
- [ ] Update CommandPalette to use dynamic action navigation
- [ ] Verify all actions still work via the dynamic page
- [ ] Run tests, fix any broken imports/references

### Sprint 2: Contextual Actions from Application Detail

**Goal:** Actions available from `/applications/[name]` grouped by workflow stage

- [ ] Read `/applications/[name]/page.tsx` to understand current structure
- [ ] Add "Available Actions" section to application detail page
- [ ] Group actions by stage: Apply (create, fetch, tailor, score, apply), Research (company, contacts, competitor, job-fit), Interview (prep, brief, STAR, quiz), Offer (salary, negotiate, thankyou), Outreach (recruiter, linkedin)
- [ ] Pre-fill application name when launching actions from detail page
- [ ] Add "Recent Actions" section showing last 5 actions with status
- [ ] Add "Back to Application" link from action results
- [ ] Verify action launching works from application detail page

### Sprint 3: Sidebar Simplification & Reports Merge

**Goal:** Reduce sidebar to ~9 items, merge reports into dashboard

- [ ] New sidebar structure:
  - **Main:** Dashboard, Applications, Board, Calendar, History, Stats, Search, Actions, Settings
  - Remove sections: Application Workflow, CV Generation, Intelligence, Interview, Salary & Negotiation, Outreach, LinkedIn, Reports
- [ ] Merge Apply Board, Pipeline Digest, Discover Jobs content into Dashboard page
- [ ] Merge LinkedIn actions into single "LinkedIn" card in Actions page
- [ ] Update mobile bottom nav to match new structure
- [ ] Remove unused sidebar section components
- [ ] Verify all routes still accessible

### Sprint 4: Split Monolithic Components

**Goal:** Settings and Applications pages split into manageable files

- [ ] Split Settings page (1243 lines):
  - Extract each tab as separate component: `SettingsApiConfig`, `SettingsTheme`, `SettingsNotifications`, `SettingsAI`, `SettingsSecurity`, `SettingsIntegrations`
  - Settings page becomes tab container only (~100 lines)
- [ ] Split Applications page (1119 lines):
  - Extract: `FilterBar`, `BatchActionBar`, `TagEditorDialog`, `ApplicationTable`, `ApplicationCard`
  - Applications page becomes container only (~150 lines)
- [ ] Fix all imports across the codebase
- [ ] Run tests, verify no regressions

### Sprint 5: localStorage Migration to API

**Goal:** Move business data from localStorage to cv-api persistence

- [ ] Identify all localStorage keys: tags, ATS scores, CV health, AI provider prefs, theme prefs, action history
- [ ] Check cv-api for existing endpoints for these data types
- [ ] Add missing endpoints to cv-api if needed (tags, scores, prefs)
- [ ] Update cv-manager API client to read/write from cv-api
- [ ] Migrate existing localStorage data on first load (one-time migration)
- [ ] Keep only UI prefs in localStorage (theme, sidebar collapsed)
- [ ] Verify data persists across sessions

## Dependencies

Sprint 1 → Sprint 2 (actions must exist before being contextual)
Sprint 1 → Sprint 3 (sidebar needs actions page to exist)
Sprint 2 → Sprint 4 (application detail changes affect component split)
Sprint 3 → Sprint 4 (sidebar changes affect component imports)
Sprint 5 is independent (can run in parallel with 1-4)

## Batch Plan

**Batch 1 (parallel):** Sprint 1 + Sprint 5 (independent)
**Batch 2 (sequential, depends on Batch 1):** Sprint 2 + Sprint 3
**Batch 3 (sequential, depends on Batch 2):** Sprint 4

## Execution Config

```bash
# Build
pnpm build

# Lint
pnpm lint

# Lint fix
pnpm lint --fix

# Type check
npx tsc --noEmit

# Test
pnpm test

# E2E
pnpm test:e2e

# Dev server
pnpm dev (port 3000)

# Kill
pkill -f "next dev" || true
```

## Files Likely Modified

- `src/app/actions/**/*` — major restructure
- `src/app/applications/[name]/page.tsx` — add contextual actions
- `src/components/Sidebar/**/*` — simplify menu
- `src/components/CommandPalette/**/*` — update action navigation
- `src/app/settings/page.tsx` — split into components
- `src/app/page.tsx` — merge reports content
- `src/lib/api.ts` — add new API calls for localStorage migration
- New: `src/lib/action-registry.ts` — action metadata
- New: `src/components/actions/*` — action grid, dynamic runner
- New: `src/components/settings/*` — split settings tabs
- New: `src/components/applications/*` — split application components
