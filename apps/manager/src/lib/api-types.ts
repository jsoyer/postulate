/**
 * TypeScript types matching cv-api response shapes.
 * These are the canonical types for the target architecture.
 * All data flows through these types once migration from cv-data.ts is complete.
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

export interface UpdateApplicationRequest {
  status?: ApplicationStatus
  company?: string
  position?: string
  followup_date?: string
  deadline?: string
}

export interface NotesResponse {
  content: string
}

export interface UploadResponse {
  ok: boolean
  filename: string
}

export interface SkillsGapResponse {
  missing: string[]
  present: string[]
}

export interface SearchMatch {
  file: string
  snippet: string
}

export interface SearchResult {
  name: string
  company: string
  position: string
  stage: string
  matches: SearchMatch[]
}

export interface SearchResponse {
  results: SearchResult[]
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
  pdfa_enabled: boolean
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
// Application Metadata (Tags, ATS Scores, Preferences)
// ---------------------------------------------------------------------------

export interface AppTagsResponse {
  tags: string[]
}

export interface AtsScoreEntry {
  date: string
  score: number
}

export interface AtsHistoryResponse {
  history: AtsScoreEntry[]
}

export interface AppPreferences {
  ai_provider?: string
  theme?: string
}

export interface AppPreferencesUpdate {
  ai_provider?: string
  theme?: string
}

// ---------------------------------------------------------------------------
// Action History
// ---------------------------------------------------------------------------

export interface ActionHistoryEntry {
  action: string
  params: Record<string, string>
  lines: string[]
  timestamp: number
  success: boolean
}

export interface ActionHistoryResponse {
  entries: ActionHistoryEntry[]
  total: number
}

// ---------------------------------------------------------------------------
// RSS Job Discovery
// ---------------------------------------------------------------------------

export interface RssJob {
  title: string
  company: string
  location: string
  url: string
  posted: string
  description_snippet: string
  keywords_matched: string[]
  source: string
}

export interface RssJobResponse {
  jobs: RssJob[]
  total: number
  sources_checked: number
  timestamp: string
}

// ---------------------------------------------------------------------------
// Job Match AI
// ---------------------------------------------------------------------------

export interface JobMatchBreakdown {
  skills: { score: number; matched: string[]; missing: string[] }
  experience: { score: number; notes: string }
  location: { score: number; notes: string }
  salary: { score: number; notes: string }
  culture: { score: number; notes: string }
}

export interface JobMatchResponse {
  overall_score: number
  breakdown: JobMatchBreakdown
  red_flags: string[]
  recommendation: "proceed" | "caution" | "skip"
  reasoning: string
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
