/**
 * HTTP client for cv-api.
 *
 * Server-side only — uses process.env directly and relies on the Node.js
 * fetch global (available in Next.js 13+). Do not import this module in
 * client components; use api-hooks.ts instead (which calls Next.js API routes
 * that themselves call this client).
 */

import {
  ApiError,
  ApiErrorBody,
  ActionResult,
  ActionHistoryEntry,
  ActionHistoryResponse,
  AppPreferences,
  AppPreferencesUpdate,
  AppTagsResponse,
  Application,
  AtsHistoryResponse,
  AtsScoreEntry,
  CreateApplicationRequest,
  DashboardData,
  HealthResponse,
  JobMatchResponse,
  NotesResponse,
  Settings,
  SkillsGapResponse,
  StatsData,
  Target,
  SearchResponse,
  UpdateApplicationRequest,
  UploadResponse,
} from "./api-types"

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    const json = (await response.json()) as Partial<ApiErrorBody>
    return {
      code: json.code ?? response.status,
      message: json.message ?? response.statusText,
    }
  } catch {
    return { code: response.status, message: response.statusText }
  }
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

export class CvApiClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    // Strip trailing slash so callers don't need to worry about it
    this.baseUrl = baseUrl.replace(/\/$/, "")
    this.apiKey = apiKey
  }

  // -------------------------------------------------------------------------
  // Core request helper
  // -------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown
      searchParams?: Record<string, string | undefined>
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)

    if (options.searchParams) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value)
        }
      }
    }

    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    }

    const init: RequestInit = {
      method,
      headers,
    }

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body)
    }

    const response = await fetch(url.toString(), init)

    if (!response.ok) {
      const errorBody = await parseErrorBody(response)
      throw new ApiError(response.status, errorBody)
    }

    // 204 No Content — return empty object cast to T
    if (response.status === 204) {
      return {} as T
    }

    return response.json() as Promise<T>
  }

  // -------------------------------------------------------------------------
  // Applications
  // -------------------------------------------------------------------------

  listApplications(status?: string): Promise<Application[]> {
    return this.request<Application[]>("GET", "/api/applications", {
      searchParams: { status },
    })
  }

  getApplication(name: string): Promise<Application> {
    return this.request<Application>("GET", `/api/applications/${encodeURIComponent(name)}`)
  }

  createApplication(data: CreateApplicationRequest): Promise<Application> {
    return this.request<Application>("POST", "/api/applications", { body: data })
  }

  updateApplication(name: string, data: UpdateApplicationRequest): Promise<Application> {
    return this.request<Application>("PATCH", `/api/applications/${encodeURIComponent(name)}`, { body: data })
  }

  getNotes(name: string): Promise<NotesResponse> {
    return this.request<NotesResponse>("GET", `/api/applications/${encodeURIComponent(name)}/notes`)
  }

  updateNotes(name: string, content: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("PUT", `/api/applications/${encodeURIComponent(name)}/notes`, {
      body: { content },
    })
  }

  getSkillsGap(name: string): Promise<SkillsGapResponse> {
    return this.request<SkillsGapResponse>("GET", `/api/applications/${encodeURIComponent(name)}/skills-gap`)
  }

  search(query: string): Promise<SearchResponse> {
    return this.request<SearchResponse>("GET", "/api/search", {
      searchParams: { q: query },
    })
  }

  async uploadFile(name: string, file: File | Blob, filename: string): Promise<UploadResponse> {
    const url = new URL(`${this.baseUrl}/api/applications/${encodeURIComponent(name)}/files`)
    const formData = new FormData()
    formData.append("file", file, filename)

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "X-API-Key": this.apiKey },
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await parseErrorBody(response)
      throw new ApiError(response.status, errorBody)
    }

    return response.json() as Promise<UploadResponse>
  }

  getFileUrl(name: string, filename: string): string {
    return `${this.baseUrl}/api/applications/${encodeURIComponent(name)}/files/${encodeURIComponent(filename)}`
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /**
   * Execute an action and receive the result (202 Accepted, polled to completion).
   * For streaming output, use streamAction() instead.
   */
  executeAction(
    target: string,
    application?: string,
    args?: Record<string, string>
  ): Promise<ActionResult> {
    return this.request<ActionResult>("POST", `/api/actions/${encodeURIComponent(target)}`, {
      body: { target, application, args },
    })
  }

  getActionStatus(jobId: string): Promise<ActionResult> {
    return this.request<ActionResult>("GET", `/api/actions/${encodeURIComponent(jobId)}`)
  }

  listTargets(): Promise<Target[]> {
    return this.request<Target[]>("GET", "/api/targets")
  }

  // -------------------------------------------------------------------------
  // Dashboard & Stats
  // -------------------------------------------------------------------------

  getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>("GET", "/api/dashboard")
  }

  getStats(): Promise<StatsData> {
    return this.request<StatsData>("GET", "/api/stats")
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  getSettings(): Promise<Settings> {
    return this.request<Settings>("GET", "/api/settings")
  }

  updateSettings(settings: Settings): Promise<Settings> {
    return this.request<Settings>("PUT", "/api/settings", { body: settings })
  }

  updatePdfaSetting(enabled: boolean): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("POST", "/api/settings", {
      body: { pdfa_enabled: enabled },
    })
  }

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------

  /**
   * Open a WebSocket connection for streaming action output.
   *
   * The caller is responsible for handling WsMessage events and closing the
   * socket. The API key is passed as a query parameter because the WebSocket
   * handshake cannot carry custom headers in the browser.
   *
   * Usage (server-side or client-side, as long as WebSocket is available):
   *
   *   const ws = cvApi.streamAction("tailor", "acme-2025-01")
   *   ws.onmessage = (event) => {
   *     const msg: WsMessage = JSON.parse(event.data)
   *     ...
   *   }
   */
  streamAction(target: string, application?: string): WebSocket {
    const wsBase = this.baseUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")

    const url = new URL(`${wsBase}/ws/actions/${encodeURIComponent(target)}`)
    url.searchParams.set("api_key", this.apiKey)
    if (application) {
      url.searchParams.set("application", application)
    }

    return new WebSocket(url.toString())
  }

  // -------------------------------------------------------------------------
  // Application Metadata (Tags, ATS Scores, Preferences)
  // -------------------------------------------------------------------------

  getTags(name: string): Promise<AppTagsResponse> {
    return this.request<AppTagsResponse>("GET", `/api/applications/${encodeURIComponent(name)}/tags`)
  }

  updateTags(name: string, tags: string[]): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("PUT", `/api/applications/${encodeURIComponent(name)}/tags`, {
      body: { tags },
    })
  }

  getAtsScores(name: string): Promise<AtsHistoryResponse> {
    return this.request<AtsHistoryResponse>("GET", `/api/applications/${encodeURIComponent(name)}/ats-scores`)
  }

  recordAtsScore(name: string, entry: AtsScoreEntry): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("POST", `/api/applications/${encodeURIComponent(name)}/ats-scores`, {
      body: entry,
    })
  }

  getPreferences(name: string): Promise<AppPreferences> {
    return this.request<AppPreferences>("GET", `/api/applications/${encodeURIComponent(name)}/preferences`)
  }

  updatePreferences(name: string, prefs: AppPreferencesUpdate): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("PATCH", `/api/applications/${encodeURIComponent(name)}/preferences`, {
      body: prefs,
    })
  }

  // -------------------------------------------------------------------------
  // Job Match
  // -------------------------------------------------------------------------

  runJobMatch(name: string, ai?: string, threshold?: number): Promise<JobMatchResponse> {
    return this.request<JobMatchResponse>("POST", `/api/applications/${encodeURIComponent(name)}/match`, {
      searchParams: { ai, threshold: threshold?.toString() },
    })
  }

  getJobMatch(name: string): Promise<JobMatchResponse | null> {
    return this.request<JobMatchResponse | null>("GET", `/api/applications/${encodeURIComponent(name)}/match`)
  }

  // -------------------------------------------------------------------------
  // Action History
  // -------------------------------------------------------------------------

  getActionHistory(): Promise<ActionHistoryResponse> {
    return this.request<ActionHistoryResponse>("GET", "/api/action-history")
  }

  recordAction(entry: Omit<ActionHistoryEntry, "lines">): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("POST", "/api/action-history", {
      body: entry,
    })
  }

  clearActionHistory(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("DELETE", "/api/action-history")
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async health(): Promise<boolean> {
    try {
      const result = await this.request<HealthResponse>("GET", "/health")
      return result.status === "ok"
    } catch {
      return false
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

function createClientFromEnv(): CvApiClient {
  const baseUrl = process.env.CV_API_URL
  const apiKey = process.env.CV_API_KEY

  if (!baseUrl) {
    throw new Error(
      "CV_API_URL is not set. Add it to .env.local (see .env.example)."
    )
  }
  if (!apiKey) {
    throw new Error(
      "CV_API_KEY is not set. Add it to .env.local (see .env.example)."
    )
  }

  return new CvApiClient(baseUrl, apiKey)
}

/**
 * Pre-configured singleton. Import and use directly in API routes and server
 * components. The env vars are read lazily on first access so tests can set
 * them before importing this module.
 */
let _client: CvApiClient | null = null

export function getCvApiClient(): CvApiClient {
  if (!_client) {
    _client = createClientFromEnv()
  }
  return _client
}

/**
 * Override the singleton (useful in tests).
 */
export function setCvApiClient(client: CvApiClient): void {
  _client = client
}

export { ApiError } from "./api-types"
