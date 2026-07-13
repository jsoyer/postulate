# SDK Type Drift Report

Generated: 2026-06-26
Source of truth: `docs/openapi.yml`
Generated types: `sdk/typescript/types.gen.ts`
Manual types: `sdk/typescript/types.ts`

## Resolution Status: R1 (2026-06-26)

All items below were resolved by rewriting `types.ts` as thin re-export aliases
over `types.gen.ts` (auto-generated from `../../docs/openapi.yml`).
Future type drift is prevented: run `npm run generate` to re-sync.

## Summary

`types.ts` was written by hand before the OpenAPI spec existed. Comparing the
40 schemas in the spec against the 35 interfaces in `types.ts` reveals 10 schemas
present in the spec but absent from `types.ts`, 4 interfaces present in `types.ts`
but absent from the spec, and 15 field-level divergences across shared types.
The most dangerous divergences are `StatsData` (completely different shape) and
`NoteVersion` (renamed fields), both of which will silently break code that uses
`types.ts` against a real server.

## Divergences

### Types only in manual `types.ts` (not in OpenAPI spec as schemas)

| Manual interface | Notes |
|---|---|
| `ListParams` | Represented as operation query parameters in the spec, not a reusable schema |
| `PagedResult<T>` | Pagination is expressed via HTTP headers (`X-Total-Count`, `X-Next-Cursor`) in the spec — no schema |
| `DashboardData` | Spec names this `DashboardResponse` and adds `ai_provider_calls_total?` — **[RESOLVED R1]** re-exported as alias from spec |
| `StatsData` (manual shape) | Manual has `{ total, by_status }` — spec has `{ funnel, timeline }` (see field diffs) — **[RESOLVED R1]** re-exported from spec with correct shape |

### Types only in generated `types.gen.ts` (in OpenAPI spec, missing from manual)

| Generated schema | Notes |
|---|---|
| `HealthAuditHistoryResponse` | New endpoint added to spec, no counterpart in `types.ts` — **[RESOLVED R1]** added as re-export alias |
| `JobMatchRequest` | AI job match request body, missing from `types.ts` — **[RESOLVED R1]** added as re-export alias |
| `JobMatchResponse` | AI job match result, missing from `types.ts` — **[RESOLVED R1]** added as re-export alias |
| `DashboardResponse` | Spec name for `DashboardData`; adds `ai_provider_calls_total?` — **[RESOLVED R1]** added as re-export alias |
| `TimelineEntry` | Sub-type used by `StatsData.timeline`, missing from `types.ts` — **[RESOLVED R1]** added as re-export alias |
| `SessionListResponse` | Wraps `Session[]`; list sessions endpoint returns this wrapper — **[RESOLVED R1]** added as re-export alias; `listSessions()` now unwraps `.sessions` |
| `APIKeyListResponse` | Wraps `APIKeyInfo[]`; list keys endpoint returns this wrapper — **[RESOLVED R1]** added as re-export alias; `listAPIKeys()` now unwraps `.keys` |
| `GenerateAPIKeyRequest` | Request body for key creation, missing from `types.ts` — **[RESOLVED R1]** added as re-export alias |
| `GenerateAPIKeyResponse` | Returns full key value exactly once, missing from `types.ts` — **[RESOLVED R1]** added as re-export alias; `generateAPIKey()` return type updated |
| `RestoreResponse` | Backup restore result, missing from `types.ts` — **[RESOLVED R1]** added as re-export alias |

### Field-level differences (types present in both but diverging)

| Type | Field | `types.ts` (manual) | `types.gen.ts` (spec) | Risk | Status |
|---|---|---|---|---|---|
| `Application` | all core fields | required (`name`, `company`, `position`, `status`, `created_at`) | all optional | MEDIUM — runtime responses may omit fields | **[RESOLVED R1]** re-export alias uses spec's optional fields |
| `ActionRequest` | `target` | `string` (required) | **absent** | HIGH — `target` is not a body field in the spec; it is a path parameter | **[RESOLVED R1]** removed from all 27 ActionRequest body objects in `client.ts` |
| `WSMessage` | `type` | `string` (wide) | `"stdout" \| "stderr" \| "exit" \| "error"` (enum) | LOW — manual is looser, not breaking | **[RESOLVED R1]** re-export alias uses spec's enum |
| `HealthResponse` | `ai_providers` | `Record<string, boolean>` | Structured `{gemini?, anthropic?, openai?, mistral?, ollama?}` | LOW — manual is looser | **[RESOLVED R1]** re-export alias uses spec's structured type |
| `HealthResponse` | `ai_provider_calls` | `Record<string, number> \| null` | **absent from spec** | MEDIUM — field not in spec but present in manual | **[RESOLVED R1]** re-export alias follows spec (field dropped) |
| `Theme` | `font_size` | **absent** | `string` (required) | HIGH — clients will miss this field | **[RESOLVED R1]** re-export alias includes `font_size` from spec |
| `BulkUpdateRequest` | `update` | required | optional | LOW | **[RESOLVED R1]** re-export alias uses spec's optional |
| `NoteVersion` | `saved_at` | `string` | **absent** — spec uses `created_at` | HIGH — wrong field name, always undefined | **[RESOLVED R1]** re-export alias uses `created_at` from spec |
| `NoteVersion` | `size_bytes` | `number` | **absent** — spec uses `size` | HIGH — wrong field name, always undefined | **[RESOLVED R1]** re-export alias uses `size` from spec |
| `Session` | `role` | `string` | `"viewer" \| "editor" \| "admin"` (enum) | LOW — manual is looser | **[RESOLVED R1]** re-export alias uses spec's enum |
| `Session` | `user_agent`, `ip` | required | optional | MEDIUM — accessing without null check may throw | **[RESOLVED R1]** re-export alias uses spec's optional |
| `APIKeyInfo` | `role` | `string` | `"viewer" \| "editor" \| "admin"` (enum) | LOW — manual is looser | **[RESOLVED R1]** re-export alias uses spec's enum |
| `AuditEntry` | `action`, `result` | `string` | enums | LOW — manual is looser | **[RESOLVED R1]** re-export alias uses spec's enums |
| `AuditEntry` | `resource`, `user`, `ip`, `detail` | all required `string` | all optional | MEDIUM — accessing without null check may throw | **[RESOLVED R1]** re-export alias uses spec's optional |
| `Target` | `args`, `timeout` | required | optional | LOW | **[RESOLVED R1]** re-export alias uses spec's optional |
| `StatsData` | shape | `{ total: number; by_status: Record<string,number> }` | `{ funnel: Record<string,number>; timeline: TimelineEntry[] }` | **CRITICAL** — completely different shape; `total` and `by_status` do not exist in spec | **[RESOLVED R1]** re-export alias uses correct spec shape |

### Structural differences

`types.ts` uses flat ES interfaces (e.g. `import { Application } from "./types"`).
`types.gen.ts` uses a namespace-based structure generated by openapi-typescript.
Schemas are accessed as `components["schemas"]["Application"]` — direct import requires
re-exporting or using type aliases:

```ts
// Access generated type
type Application = components["schemas"]["Application"];

// Or re-export
export type { components } from "./types.gen.ts";
```

The `paths` and `operations` namespaces expose request/response body types per endpoint,
which `types.ts` does not model at all.

**[RESOLVED R1]** `types.ts` was rewritten as thin re-export aliases using exactly this
pattern — each type is `export type Foo = components["schemas"]["Foo"]`. The structural
gap is closed; consumers continue to `import { Application } from "./types"` unchanged.

## Risk Assessment

R1 (drift risk): **HIGH** — 15 field-level divergences including 4 HIGH/CRITICAL items
(`ActionRequest.target` mismatch, `NoteVersion` field renames, `Theme.font_size` missing,
`StatsData` completely wrong shape). Code using `types.ts` against a real server will
silently receive wrong data for these fields. The `StatsData` divergence will cause
runtime errors for any code reading `total` or `by_status` from the stats endpoint.

**[RESOLVED R1 — 2026-06-26]** All HIGH/CRITICAL items fixed. Re-run `npm run generate`
after any OpenAPI spec change to keep `types.gen.ts` current; `types.ts` will auto-align.
