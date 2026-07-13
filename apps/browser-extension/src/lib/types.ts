/**
 * Shared types mirroring cv-api response shapes.
 * Kept in sync with cv-api/internal/models/models.go.
 */

// ---------------------------------------------------------------------------
// Job extraction
// ---------------------------------------------------------------------------

export type JobSource = "linkedin" | "indeed" | "wttj"

export interface JobData {
  company: string
  position: string
  description: string
  url: string
  source: JobSource
}

// ---------------------------------------------------------------------------
// Application (mirrors cv-api Application model)
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
  created_at: string
  deadline?: string
  outcome?: string
  files?: Record<string, string>
}

export interface CreateApplicationRequest {
  company: string
  position: string
  url?: string
}

export interface UpdateApplicationRequest {
  status?: ApplicationStatus
  company?: string
  position?: string
  followup_date?: string
  deadline?: string
}

// ---------------------------------------------------------------------------
// Actions (mirrors cv-api ActionResult model)
// ---------------------------------------------------------------------------

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

export interface ActionRequest {
  target: string
  application?: string
  args?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  total_applications: number
  by_status: Record<string, number>
  recent_applications: Application[]
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: "ok" | "degraded" | "down"
  version?: string
  uptime_seconds?: number
}

// ---------------------------------------------------------------------------
// API Error
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  code: number
  message: string
}

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

// ---------------------------------------------------------------------------
// Extension storage settings
// ---------------------------------------------------------------------------

export interface ExtensionSettings {
  apiUrl: string
  apiKey: string
  theme: "light" | "dark" | "system"
  badgeEnabled: boolean
  notificationsEnabled: boolean
}

// ---------------------------------------------------------------------------
// Background message protocol
// ---------------------------------------------------------------------------

export type MessageType =
  | "ADD_TO_PIPELINE"
  | "PIPELINE_SUCCESS"
  | "PIPELINE_ERROR"
  | "PIPELINE_PROGRESS"
  | "GET_SETTINGS"
  | "SAVE_SETTINGS"
  | "GET_RECENT_APPLICATIONS"
  | "CHECK_HEALTH"
  | "RETRY_PENDING_JOBS"
  | "GET_PENDING_JOBS"
  | "PENDING_JOBS_UPDATED"

export interface ExtensionMessage<T = unknown> {
  type: MessageType
  payload?: T
}

export interface AddToPipelinePayload {
  job: JobData
}

export interface PipelineProgressPayload {
  step: "creating" | "uploading" | "tailoring" | "done"
  applicationName?: string
  jobId?: string
  message?: string
}

export interface PipelineResult {
  application: Application
  jobId: string
}

// ---------------------------------------------------------------------------
// Pending jobs queue (offline retry)
// ---------------------------------------------------------------------------

export interface PendingJob {
  id: string
  job: JobData
  createdAt: number
  retryCount: number
  lastError?: string
}

export type RetryMessageType =
  | "RETRY_PENDING_JOBS"
  | "GET_PENDING_JOBS"
  | "PENDING_JOBS_UPDATED"

export interface RetryMessagePayload {
  jobs?: PendingJob[]
  count?: number
}
