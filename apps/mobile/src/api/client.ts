/**
 * HTTP client for cv-api.
 *
 * Implements all REST endpoints with a 10-second timeout per request.
 * Auth token is passed as a Bearer header via apiKey from secure config.
 * Non-2xx responses are thrown as ApiError; 204 No Content returns undefined.
 *
 * TODO: Add request/response interceptors for auth token refresh.
 * TODO: Add WebSocket support for streaming action output.
 */

import type {
  Application,
  ApplicationStatus,
  ActionRequest,
  ActionResult,
  ApiErrorBody,
  CreateApplicationRequest,
  DashboardData,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  StatsData,
  Target,
} from "./types"
import { ApiError } from "./types"
import { getSecureConfig } from "../lib/secure-config"

export interface CvApiClientConfig {
  baseUrl: string
  apiKey?: string
}

export class CvApiClient {
  private readonly baseUrl: string
  private readonly apiKey: string | undefined

  constructor(config: CvApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "")
    this.apiKey = config.apiKey
  }

  // ---------------------------------------------------------------------------
  // Static factory
  // ---------------------------------------------------------------------------

  static async fromSecureConfig(): Promise<CvApiClient> {
    const config = await getSecureConfig()
    if (config === null) {
      throw new Error("No API configuration found. Please configure the app first.")
    }
    return new CvApiClient({ baseUrl: config.apiUrl, apiKey: config.apiKey })
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (this.apiKey !== undefined) {
      defaultHeaders["Authorization"] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options?.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      })

      if (response.status === 204) {
        return undefined as unknown as T
      }

      const data: unknown = await response.json()

      if (!response.ok) {
        throw new ApiError(response.status, data as ApiErrorBody)
      }

      return data as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health")
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async login(req: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    })
  }

  async logout(): Promise<void> {
    return this.request<void>("/api/auth/logout", { method: "POST" })
  }

  // ---------------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------------

  async listApplications(): Promise<Application[]> {
    return this.request<Application[]>("/api/applications")
  }

  async getApplication(name: string): Promise<Application> {
    return this.request<Application>(`/api/applications/${encodeURIComponent(name)}`)
  }

  async createApplication(req: CreateApplicationRequest): Promise<Application> {
    return this.request<Application>("/api/applications", {
      method: "POST",
      body: JSON.stringify(req),
    })
  }

  async updateApplicationStatus(
    name: string,
    status: ApplicationStatus
  ): Promise<Application> {
    return this.request<Application>(`/api/applications/${encodeURIComponent(name)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
  }

  async deleteApplication(name: string): Promise<void> {
    return this.request<void>(`/api/applications/${encodeURIComponent(name)}`, {
      method: "DELETE",
    })
  }

  // ---------------------------------------------------------------------------
  // Targets (Makefile targets)
  // ---------------------------------------------------------------------------

  async listTargets(): Promise<Target[]> {
    return this.request<Target[]>("/api/targets")
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async runAction(req: ActionRequest): Promise<ActionResult> {
    return this.request<ActionResult>("/api/actions", {
      method: "POST",
      body: JSON.stringify(req),
    })
  }

  // TODO: Add WebSocket connection method for streaming action output
  // connectActionStream(target: string, application?: string): WebSocket { ... }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>("/api/dashboard")
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  async getStats(): Promise<StatsData> {
    return this.request<StatsData>("/api/stats")
  }
}
