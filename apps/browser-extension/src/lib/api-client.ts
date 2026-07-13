/**
 * cv-api HTTP client for use in browser extension contexts.
 * Settings are loaded from browser.storage.sync via the storage module.
 * Compatible with Manifest V3 service workers and content scripts.
 */

import { getSettings } from "./storage"
import type {
  ActionResult,
  ApiErrorBody,
  Application,
  CreateApplicationRequest,
  DashboardData,
  HealthResponse,
  UpdateApplicationRequest,
} from "./types"
import { ApiError } from "./types"

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

    const init: RequestInit = { method, headers }

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body)
    }

    const response = await fetch(url.toString(), init)

    if (!response.ok) {
      const errorBody = await parseErrorBody(response)
      throw new ApiError(response.status, errorBody)
    }

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
    return this.request<Application>(
      "GET",
      `/api/applications/${encodeURIComponent(name)}`
    )
  }

  createApplication(data: CreateApplicationRequest): Promise<Application> {
    return this.request<Application>("POST", "/api/applications", { body: data })
  }

  updateApplication(
    name: string,
    data: UpdateApplicationRequest
  ): Promise<Application> {
    return this.request<Application>(
      "PATCH",
      `/api/applications/${encodeURIComponent(name)}`,
      { body: data }
    )
  }

  async uploadFile(
    name: string,
    content: string,
    filename: string
  ): Promise<{ ok: boolean; filename: string }> {
    const url = new URL(
      `${this.baseUrl}/api/applications/${encodeURIComponent(name)}/files`
    )
    const blob = new Blob([content], { type: "text/plain" })
    const formData = new FormData()
    formData.append("file", blob, filename)

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "X-API-Key": this.apiKey },
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await parseErrorBody(response)
      throw new ApiError(response.status, errorBody)
    }

    return response.json() as Promise<{ ok: boolean; filename: string }>
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  executeAction(
    target: string,
    application?: string,
    args?: Record<string, string>
  ): Promise<ActionResult> {
    return this.request<ActionResult>(
      "POST",
      `/api/actions/${encodeURIComponent(target)}`,
      { body: { target, application, args } }
    )
  }

  getActionStatus(jobId: string): Promise<ActionResult> {
    return this.request<ActionResult>(
      "GET",
      `/api/actions/jobs/${encodeURIComponent(jobId)}`
    )
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>("GET", "/api/dashboard")
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health")
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.health()
      return result.status === "ok"
    } catch {
      return false
    }
  }
}

// ---------------------------------------------------------------------------
// Factory — loads settings from browser.storage at call time
// ---------------------------------------------------------------------------

export async function createClientFromStorage(): Promise<CvApiClient> {
  const settings = await getSettings()

  if (!settings.apiUrl) {
    throw new Error("cv-api URL is not configured. Open the extension options.")
  }
  if (!settings.apiKey) {
    throw new Error("API key is not configured. Open the extension options.")
  }

  return new CvApiClient(settings.apiUrl, settings.apiKey)
}
