/**
 * Public types for cv-api TypeScript SDK.
 *
 * Source of truth: docs/openapi.yml  →  regenerate with `npm run generate`.
 * All types below are thin aliases over the auto-generated types.gen.ts so
 * that the spec is always the single source of truth and drift is impossible.
 *
 * DO NOT add hand-written interface shapes here.  Add an alias instead.
 */

import type { components } from "./types.gen.js";

// ── Core resource types ───────────────────────────────────────────────────────

export type Application             = components["schemas"]["Application"];
export type CreateApplicationRequest = components["schemas"]["CreateApplicationRequest"];
export type UpdateApplicationRequest = components["schemas"]["UpdateApplicationRequest"];
export type BulkUpdateRequest       = components["schemas"]["BulkUpdateRequest"];
export type BulkUpdateResponse      = components["schemas"]["BulkUpdateResponse"];

// ── Notes ─────────────────────────────────────────────────────────────────────

export type NoteVersion      = components["schemas"]["NoteVersion"];
export type NotesResponse    = components["schemas"]["NotesResponse"];
export type WriteNotesRequest = components["schemas"]["WriteNotesRequest"];

// ── Actions ───────────────────────────────────────────────────────────────────

/** Body for POST /api/actions/{target}. `target` is a PATH parameter, not a body field. */
export type ActionRequest = components["schemas"]["ActionRequest"];
export type ActionResult  = components["schemas"]["ActionResult"];

// ── Health & audit ────────────────────────────────────────────────────────────

export type HealthResponse             = components["schemas"]["HealthResponse"];
export type HealthAuditScores          = components["schemas"]["HealthAuditScores"];
export type HealthAuditResponse        = components["schemas"]["HealthAuditResponse"];
export type HealthAuditHistoryResponse = components["schemas"]["HealthAuditHistoryResponse"];

// ── Auth ──────────────────────────────────────────────────────────────────────

export type LoginRequest  = components["schemas"]["LoginRequest"];
export type LoginResponse = components["schemas"]["LoginResponse"];

// ── Common ────────────────────────────────────────────────────────────────────

export type OKResponse     = components["schemas"]["OKResponse"];
export type UploadResponse = components["schemas"]["UploadResponse"];
export type APIError       = components["schemas"]["APIError"];
export type Settings       = components["schemas"]["Settings"];
export type WSMessage      = components["schemas"]["WSMessage"];

// ── Search ────────────────────────────────────────────────────────────────────

export type SearchMatch    = components["schemas"]["SearchMatch"];
export type SearchResult   = components["schemas"]["SearchResult"];
export type SearchResponse = components["schemas"]["SearchResponse"];

// ── Skills gap ────────────────────────────────────────────────────────────────

export type SkillsGapResponse = components["schemas"]["SkillsGapResponse"];

// ── Dashboard & stats ─────────────────────────────────────────────────────────

export type DashboardResponse = components["schemas"]["DashboardResponse"];
export type TimelineEntry     = components["schemas"]["TimelineEntry"];
export type StatsData         = components["schemas"]["StatsData"];

/** @deprecated Spec renamed this to DashboardResponse. Use DashboardResponse. */
export type DashboardData = DashboardResponse;

// ── Themes ────────────────────────────────────────────────────────────────────

export type Theme = components["schemas"]["Theme"];

// ── Targets ───────────────────────────────────────────────────────────────────

export type Target = components["schemas"]["Target"];

// ── Sessions ──────────────────────────────────────────────────────────────────

export type Session             = components["schemas"]["Session"];
export type SessionListResponse = components["schemas"]["SessionListResponse"];

// ── API keys ──────────────────────────────────────────────────────────────────

export type APIKeyInfo            = components["schemas"]["APIKeyInfo"];
export type APIKeyListResponse    = components["schemas"]["APIKeyListResponse"];
export type GenerateAPIKeyRequest  = components["schemas"]["GenerateAPIKeyRequest"];
export type GenerateAPIKeyResponse = components["schemas"]["GenerateAPIKeyResponse"];

// ── Audit log ─────────────────────────────────────────────────────────────────

export type AuditEntry = components["schemas"]["AuditEntry"];

// ── Job match ─────────────────────────────────────────────────────────────────

export type JobMatchRequest  = components["schemas"]["JobMatchRequest"];
export type JobMatchResponse = components["schemas"]["JobMatchResponse"];

// ── Backup / restore ──────────────────────────────────────────────────────────

export type RestoreResponse = components["schemas"]["RestoreResponse"];

// ── Utility types (client-side only, not in spec) ────────────────────────────

/**
 * Query parameters for list endpoints.
 * These are expressed as operation query params in the spec, not a reusable schema.
 */
export interface ListParams {
  limit?: number;
  cursor?: string;
  status?: string;
  company?: string;
  sort?: string;
  order?: "asc" | "desc";
}

/**
 * Typed wrapper around paginated list responses.
 * The spec expresses pagination via HTTP headers (X-Total-Count / X-Next-Cursor),
 * not a response schema, so this helper lives only in the client SDK.
 */
export interface PagedResult<T> {
  data: T[];
  totalCount: number;
  nextCursor?: string;
}
