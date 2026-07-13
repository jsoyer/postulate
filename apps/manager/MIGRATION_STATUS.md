# Migration Status

Tracking the migration of cv-web from direct filesystem/Make access to cv-api.

See [docs/migration.md](docs/migration.md) for the full migration plan.

## Phase 1: cv-api setup

| Task | Status |
|------|--------|
| cv-api scaffold created | done |
| cv-api core implementation | pending |
| cv-api deployed locally | pending |
| API endpoints verified | pending |

## Phase 2: API client library

> Status: **in progress**

| Task | Status |
|------|--------|
| `src/lib/api-types.ts` — all cv-api TypeScript interfaces | done |
| `src/lib/api-client.ts` — typed HTTP + WebSocket client, singleton via `getCvApiClient()` | done |
| `src/lib/api-hooks.ts` — React Query hooks wrapping Next.js API routes | done |
| `docs/api-contract.md` — updated with full endpoint table, auth, health, and error shape | done |
| WebSocket client (`streamAction`) | done |
| Environment config (`CV_API_URL`, `CV_API_KEY`) | done |

### What was created

**`src/lib/api-types.ts`**
Canonical TypeScript interfaces for all cv-api shapes:
`Application`, `CreateApplicationRequest`, `ActionRequest`, `ActionResult`,
`WsMessage`, `Target`, `DashboardData`, `StatsData`, `TimelineEntry`,
`Settings`, `LoginRequest`, `LoginResponse`, `HealthResponse`,
`ApiErrorBody`, and the `ApiError` class (extends `Error`).

**`src/lib/api-client.ts`**
`CvApiClient` class with typed methods for every endpoint.
Sets `X-API-Key` on all requests, throws `ApiError` on non-2xx responses.
`streamAction()` opens a `WebSocket` with `?api_key=` query param.
Exports `getCvApiClient()` (lazy singleton) and `setCvApiClient()` (for tests).

**`src/lib/api-hooks.ts`**
React Query hooks for use in client components:
`useApplications`, `useApplication`, `useDashboard`, `useStats`,
`useTargets`, `useSettings`, `useMutateApplication`, `useExecuteAction`,
`useUpdateSettings`.
Calls Next.js API routes (not cv-api directly); API routes call `getCvApiClient()`.
Exports `queryKeys` factory for consistent cache key management.

## Phase 3: API route migration

> Status: **in progress**

### Batch 1 — Read-only data routes

| Current route | Target | Status |
|--------------|--------|--------|
| `/api/dashboard/route.ts` | `GET cv-api/api/dashboard` | done |
| `/api/applications/route.ts` (GET) | `GET cv-api/api/applications` | done |
| `/api/applications/list/route.ts` | `GET cv-api/api/applications` | done |
| `/api/applications/[name]/route.ts` | `GET cv-api/api/applications/{name}` | done |
| `/api/applications/[name]/meta/route.ts` | `GET cv-api/api/applications/{name}` | pending |
| `/api/applications/[name]/notes/route.ts` | `GET cv-api/api/applications/{name}` | pending |
| `/api/applications/[name]/pdf/route.ts` | `GET cv-api/api/applications/{name}/pdf` | pending |
| `/api/applications/[name]/skills-gap/route.ts` | `GET cv-api/api/applications/{name}/skills-gap` | pending |
| `/api/stats/route.ts` | `GET cv-api/api/stats` | done |
| `/api/settings/route.ts` | `GET/POST cv-api/api/settings` | done |
| `/api/targets/route.ts` | `GET cv-api/api/targets` | done (new) |
| `/api/search/route.ts` | client-side filtering | pending |
| `/api/templates/route.ts` | `GET cv-api/api/templates` | pending |

### Batch 2 — Application CRUD

| Current route | Target | Status |
|--------------|--------|--------|
| `/api/applications/route.ts` (POST) | `POST cv-api/api/applications` | done |
| `/api/applications/[name]/stage/route.ts` | `PUT cv-api/api/applications/{name}` | pending |
| `/api/applications/[name]/upload/route.ts` | multipart to cv-api | pending |

### Batch 3 — Action execution (consolidate 50+ routes into 1)

| Current routes | Target | Status |
|---------------|--------|--------|
| `/api/actions/apply/route.ts` | `POST cv-api/api/actions/apply` | pending |
| `/api/actions/fetch/route.ts` | `POST cv-api/api/actions/fetch` | pending |
| `/api/actions/score/route.ts` | `POST cv-api/api/actions/score` | pending |
| `/api/actions/tailor/route.ts` | `POST cv-api/api/actions/tailor` | pending |
| `/api/actions/render/route.ts` | `POST cv-api/api/actions/render` | pending |
| `/api/actions/prep/route.ts` | `POST cv-api/api/actions/prep` | pending |
| `/api/actions/research/route.ts` | `POST cv-api/api/actions/research` | pending |
| `/api/actions/diff/route.ts` | `POST cv-api/api/actions/diff` | pending |
| `/api/actions/compare/route.ts` | `POST cv-api/api/actions/compare` | pending |
| `/api/actions/archive/route.ts` | `POST cv-api/api/actions/archive` | pending |
| `/api/actions/archive-app/route.ts` | `POST cv-api/api/actions/archive-app` | pending |
| `/api/actions/ats-rank/route.ts` | `POST cv-api/api/actions/ats-rank` | pending |
| `/api/actions/contacts/route.ts` | `POST cv-api/api/actions/contacts` | pending |
| `/api/actions/competitor-map/route.ts` | `POST cv-api/api/actions/competitor-map` | pending |
| `/api/actions/cover-angles/route.ts` | `POST cv-api/api/actions/cover-angles` | pending |
| `/api/actions/culture/route.ts` | `POST cv-api/api/actions/culture` | pending |
| `/api/actions/cv-health/route.ts` | `POST cv-api/api/actions/cv-health` | pending |
| `/api/actions/digest/route.ts` | `POST cv-api/api/actions/digest` | pending |
| `/api/actions/discover/route.ts` | `POST cv-api/api/actions/discover` | pending |
| `/api/actions/docx/route.ts` | `POST cv-api/api/actions/docx` | pending |
| `/api/actions/export/route.ts` | `POST cv-api/api/actions/export` | pending |
| `/api/actions/export-csv/route.ts` | `POST cv-api/api/actions/export-csv` | pending |
| `/api/actions/email-sequence/route.ts` | `POST cv-api/api/actions/email-sequence` | pending |
| `/api/actions/followup/route.ts` | `POST cv-api/api/actions/followup` | pending |
| `/api/actions/glassdoor/route.ts` | `POST cv-api/api/actions/glassdoor` | pending |
| `/api/actions/interview-brief/route.ts` | `POST cv-api/api/actions/interview-brief` | pending |
| `/api/actions/interview-debrief/route.ts` | `POST cv-api/api/actions/interview-debrief` | pending |
| `/api/actions/job-fit/route.ts` | `POST cv-api/api/actions/job-fit` | pending |
| `/api/actions/linkedin/route.ts` | `POST cv-api/api/actions/linkedin` | pending |
| `/api/actions/linkedin-message/route.ts` | `POST cv-api/api/actions/linkedin-message` | pending |
| `/api/actions/linkedin-post/route.ts` | `POST cv-api/api/actions/linkedin-post` | pending |
| `/api/actions/linkedin-profile/route.ts` | `POST cv-api/api/actions/linkedin-profile` | pending |
| `/api/actions/milestone/route.ts` | `POST cv-api/api/actions/milestone` | pending |
| `/api/actions/negotiate/route.ts` | `POST cv-api/api/actions/negotiate` | pending |
| `/api/actions/notion/route.ts` | `POST cv-api/api/actions/notion` | pending |
| `/api/actions/prep-star/route.ts` | `POST cv-api/api/actions/prep-star` | pending |
| `/api/actions/quarterly/route.ts` | `POST cv-api/api/actions/quarterly` | pending |
| `/api/actions/questions/route.ts` | `POST cv-api/api/actions/questions` | pending |
| `/api/actions/recruiter/route.ts` | `POST cv-api/api/actions/recruiter` | pending |
| `/api/actions/recruiter-email/route.ts` | `POST cv-api/api/actions/recruiter-email` | pending |
| `/api/actions/run/route.ts` | `POST cv-api/api/actions/run` | pending |
| `/api/actions/salary/route.ts` | `POST cv-api/api/actions/salary` | pending |
| `/api/actions/salary-bench/route.ts` | `POST cv-api/api/actions/salary-bench` | pending |
| `/api/actions/salary-report/route.ts` | `POST cv-api/api/actions/salary-report` | pending |
| `/api/actions/skills/route.ts` | `POST cv-api/api/actions/skills` | pending |
| `/api/actions/star/route.ts` | `POST cv-api/api/actions/star` | pending |
| `/api/actions/stream/route.ts` | `WS cv-api/ws/actions/{target}` | pending |
| `/api/actions/tasks/route.ts` | `POST cv-api/api/actions/tasks` | pending |
| `/api/actions/thankyou/route.ts` | `POST cv-api/api/actions/thankyou` | pending |
| `/api/actions/trends/route.ts` | `POST cv-api/api/actions/trends` | pending |
| `/api/actions/weekly/route.ts` | `POST cv-api/api/actions/weekly` | pending |
| `/api/actions/ai-cover-letter/route.ts` | `POST cv-api/api/actions/ai-cover-letter` | pending |
| `/api/actions/ai-interview-prep/route.ts` | `POST cv-api/api/actions/ai-interview-prep` | pending |
| `/api/actions/apply-board/route.ts` | `POST cv-api/api/actions/apply-board` | pending |
| `/api/actions/blog/route.ts` | `POST cv-api/api/actions/blog` | pending |
| `/api/actions/brand/route.ts` | `POST cv-api/api/actions/brand` | pending |
| `/api/actions/cold-sequence/route.ts` | `POST cv-api/api/actions/cold-sequence` | pending |

**Post-migration**: All 55+ individual route files replaced by a single `/api/actions/[target]/route.ts` that proxies to cv-api.

### Batch 4 — Auth routes

| Current route | Target | Status |
|--------------|--------|--------|
| `/api/auth/login/route.ts` | proxy to cv-api | pending |
| `/api/auth/logout/route.ts` | proxy to cv-api | pending |
| `/api/auth/status/route.ts` | local JWT check or proxy | pending |
| `/api/auth/passkey/register/route.ts` | proxy to cv-api | pending |
| `/api/auth/passkey/verify/route.ts` | proxy to cv-api | pending |

### Batch 5 — Remaining routes

| Current route | Target | Status |
|--------------|--------|--------|
| `/api/cv/render/route.ts` | `POST cv-api/api/actions/render` | pending |
| `/api/tailor/route.ts` | `POST cv-api/api/actions/tailor` | pending |
| `/api/export/ical/route.ts` | `GET cv-api/api/export/ical` | pending |
| `/api/webhook/route.ts` | keep or move to cv-api | pending |
| `/api/webhook/events/route.ts` | keep or move to cv-api | pending |

## Phase 4: Remove filesystem dependencies

| Task | Status |
|------|--------|
| Delete `src/lib/cv-data.ts` | pending |
| Remove `CV_PATH` from config | pending |
| Remove `execFile` / `child_process` | pending |
| Remove `js-yaml` dependency | pending |

## Phase 5: Simplify auth

| Task | Status |
|------|--------|
| Move credential validation to cv-api | pending |
| Remove `@otplib/preset-default` | pending |
| Remove `@simplewebauthn/*` | pending |
