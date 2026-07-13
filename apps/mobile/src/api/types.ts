/**
 * TypeScript types matching cv-api response shapes.
 * Mirrored from cv-manager/src/lib/api-types.ts.
 *
 * TODO: Keep in sync with cv-api OpenAPI spec when available.
 */

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "ghosted"

export interface Application {
  name: string
  company: string
  position: string
  status: ApplicationStatus
  created_at: string // ISO 8601
  deadline?: string
  outcome?: string
  // Present only on GET /api/applications/{name}
  files?: Record<string, string>
}

export interface CreateApplicationRequest {
  company: string
  position: string
  url?: string
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface ActionRequest {
  target: string
  application?: string
  args?: Record<string, string>
}

export type ActionStatus = "running" | "completed" | "failed" | "cancelled"

export interface ActionResult {
  job_id: string
  target: string
  status: ActionStatus
  exit_code: number
  stdout?: string
  stderr?: string
  duration_ms: number
}

// WebSocket message streamed from /ws/actions/{target}
export type WsMessageType = "stdout" | "stderr" | "exit" | "error"

export interface WsMessage {
  type: WsMessageType
  data: string
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export interface Target {
  name: string
  category: string
  description: string
  args?: string[]
}

// ---------------------------------------------------------------------------
// Dashboard & Stats
// ---------------------------------------------------------------------------

export interface DashboardData {
  total_applications: number
  by_status: Record<string, number>
  recent_applications: Application[]
}

export interface TimelineEntry {
  date: string
  count: number
}

export interface StatsData {
  funnel: Record<string, number>
  timeline: TimelineEntry[]
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  theme: string
  default_view: string
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginRequest {
  username: string
  password: string
  totp?: string
}

export interface LoginResponse {
  token: string
  expires_at: number
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down"
  version?: string
  uptime_seconds?: number
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/**
 * Shape returned by cv-api on all error responses.
 */
export interface ApiErrorBody {
  code: number
  message: string
}

/**
 * Thrown by CvApiClient when cv-api returns a non-2xx response.
 */
export class ApiError extends Error {
  readonly statusCode: number
  readonly body: ApiErrorBody

  constructor(statusCode: number, body: ApiErrorBody) {
    super(body.message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.body = body
  }
}
