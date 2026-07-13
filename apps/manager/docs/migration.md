# Migration Plan: cv-web to pure frontend

## Overview

Migrate cv-web from directly executing Make targets and reading the filesystem to calling cv-api for all backend operations. After migration, cv-web has zero dependency on the CV project filesystem.

## Phases

### Phase 1: Stand up cv-api

**Goal**: cv-api running and serving all endpoints that cv-web needs.

**Tasks**:
- [ ] Implement cv-api core (auth, executor, storage, handlers)
- [ ] Deploy cv-api locally alongside cv-web
- [ ] Verify all API endpoints return correct data
- [ ] Load-test concurrent Make execution

**Risk**: Low. cv-api is additive; cv-web continues to work as-is during this phase.

**Rollback**: Stop cv-api. cv-web is unaffected.

### Phase 2: Create API client library in cv-web

**Goal**: Add a TypeScript API client that mirrors the existing `cv-data.ts` interface but calls cv-api instead.

**Tasks**:
- [ ] Create `src/lib/api-client.ts` with typed fetch wrappers
- [ ] Create `src/lib/api-types.ts` with TypeScript interfaces matching cv-api schemas
- [ ] Add `CV_API_URL` and `CV_API_KEY` to environment config
- [ ] Add WebSocket client for streaming action output

**Risk**: Low. No existing code is modified yet.

### Phase 3: Migrate API routes (one by one)

**Goal**: Replace each Next.js API route to proxy through cv-api.

**Order**: Start with the simplest read-only routes, then move to write/execution routes.

**Batch 1 — Read-only data routes**:
- [ ] `/api/dashboard` → `GET cv-api/api/dashboard`
- [ ] `/api/applications/list` → `GET cv-api/api/applications`
- [ ] `/api/applications/[name]` → `GET cv-api/api/applications/{name}`
- [ ] `/api/stats` → `GET cv-api/api/stats`
- [ ] `/api/settings` → `GET/PUT cv-api/api/settings`
- [ ] `/api/search` → client-side filtering (no API route needed)

**Batch 2 — Application CRUD**:
- [ ] `/api/applications` (POST) → `POST cv-api/api/applications`
- [ ] `/api/applications/[name]/meta` → `PUT cv-api/api/applications/{name}`
- [ ] `/api/applications/[name]/stage` → `PUT cv-api/api/applications/{name}`
- [ ] `/api/applications/[name]/notes` → `PUT cv-api/api/applications/{name}`
- [ ] `/api/applications/[name]/upload` → multipart to cv-api
- [ ] `/api/applications/[name]/pdf` → `GET cv-api/api/applications/{name}/pdf`
- [ ] `/api/applications/[name]/skills-gap` → `GET cv-api/api/applications/{name}/skills-gap`

**Batch 3 — Action execution (50+ routes)**:
All routes under `/api/actions/*` are replaced by a single pattern:
- [ ] Remove individual action route files
- [ ] Create single `/api/actions/[target]/route.ts` that proxies to `POST cv-api/api/actions/{target}`
- [ ] Replace polling with WebSocket streaming via `/ws/actions/{target}`

**Batch 4 — Auth routes**:
- [ ] `/api/auth/login` → proxy to cv-api or keep local (decision needed)
- [ ] `/api/auth/logout` → proxy to cv-api
- [ ] `/api/auth/status` → validate JWT locally or check cv-api
- [ ] `/api/auth/passkey/*` → proxy to cv-api (future)

**Batch 5 — Remaining routes**:
- [ ] `/api/cv/render` → `POST cv-api/api/actions/render`
- [ ] `/api/tailor` → `POST cv-api/api/actions/tailor`
- [ ] `/api/templates` → `GET cv-api/api/templates`
- [ ] `/api/export/ical` → `GET cv-api/api/export/ical`
- [ ] `/api/webhook` → keep in cv-web or move to cv-api

**Risk**: Medium. Each route migration could break the corresponding UI.

**Mitigation**: Migrate one route at a time. Test the corresponding page after each migration.

**Rollback**: Revert the individual route file to restore direct `execFile` behavior.

### Phase 4: Remove direct filesystem dependencies

**Goal**: Delete `cv-data.ts`, remove `CV_PATH` from cv-web config.

**Tasks**:
- [ ] Remove `src/lib/cv-data.ts`
- [ ] Remove `CV_PATH` from `.env.example` and `.env.local`
- [ ] Remove `execFile` imports from all files
- [ ] Remove `child_process` usage
- [ ] Update `next.config.ts` (remove any server-side config for CV_PATH)
- [ ] Remove `js-yaml` dependency (YAML parsing now done by cv-api)
- [ ] Run full test suite

**Risk**: Medium. Missing a reference to cv-data.ts will cause runtime errors.

**Mitigation**: `grep -r "cv-data\|CV_PATH\|execFile\|child_process" src/` to find all references.

**Rollback**: Git revert the batch.

### Phase 5: Simplify auth

**Goal**: cv-web only manages the browser session; cv-api handles credential validation.

**Tasks**:
- [ ] Move credential validation to cv-api
- [ ] cv-web login page calls cv-api `/api/auth/login`
- [ ] cv-web stores the JWT cookie (set by cv-api, forwarded)
- [ ] Remove `@otplib/preset-default` dependency (TOTP validation moves to cv-api)
- [ ] Remove `@simplewebauthn/*` dependencies (WebAuthn moves to cv-api)

**Risk**: Low-medium. Auth changes need careful testing.

## Migration checklist

After all phases complete, verify:

- [ ] cv-web has no `execFile`, `child_process`, or `spawn` calls
- [ ] cv-web has no `CV_PATH` references
- [ ] cv-web has no direct filesystem reads of the CV project
- [ ] cv-web works when the CV project is NOT on the same machine
- [ ] All UI features work identically to before migration
- [ ] cv-web can be deployed in Docker without mounting the CV project volume
- [ ] Auth flow works end-to-end (login, session, logout)
- [ ] Action streaming works via WebSocket
