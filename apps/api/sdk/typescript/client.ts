import type {
  ActionRequest,
  ActionResult,
  APIKeyInfo,
  APIKeyListResponse,
  Application,
  AuditEntry,
  BulkUpdateRequest,
  BulkUpdateResponse,
  CreateApplicationRequest,
  DashboardResponse,
  GenerateAPIKeyResponse,
  HealthAuditHistoryResponse,
  HealthAuditResponse,
  HealthResponse,
  JobMatchRequest,
  JobMatchResponse,
  ListParams,
  LoginRequest,
  NoteVersion,
  OKResponse,
  PagedResult,
  RestoreResponse,
  SearchResponse,
  Session,
  SessionListResponse,
  Settings,
  SkillsGapResponse,
  StatsData,
  Target,
  Theme,
  UpdateApplicationRequest,
  UploadResponse,
  WSMessage,
} from "./types.js";

export class CvApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CvApiError";
  }
}

export class CvApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  // ── Core request helper ────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      let message = resp.statusText;
      try {
        const err = (await resp.json()) as { message?: string };
        if (err.message) message = err.message;
      } catch {
        // ignore parse error
      }
      throw new CvApiError(resp.status, message);
    }

    return resp.json() as Promise<T>;
  }

  private async requestBlob(method: string, path: string): Promise<Blob> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "X-API-Key": this.apiKey },
    });
    if (!resp.ok) {
      throw new CvApiError(resp.status, resp.statusText);
    }
    return resp.blob();
  }

  private async requestText(method: string, path: string): Promise<string> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "X-API-Key": this.apiKey },
    });
    if (!resp.ok) {
      throw new CvApiError(resp.status, resp.statusText);
    }
    return resp.text();
  }

  // ── Health ────────────────────────────────────────────────────────────────

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health");
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  login(
    username: string,
    password: string,
    totpCode?: string,
  ): Promise<{ token: string; expires_at: string }> {
    const req: LoginRequest = { username, password };
    if (totpCode !== undefined) req.totp = totpCode;
    return this.request("POST", "/api/auth/login", req);
  }

  logout(): Promise<void> {
    return this.request<OKResponse>("POST", "/api/auth/logout").then(
      () => undefined,
    );
  }

  // ── Applications ──────────────────────────────────────────────────────────

  listApplications(params?: ListParams): Promise<PagedResult<Application>> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
    }
    const query = qs.toString();
    return this.request<PagedResult<Application>>(
      "GET",
      `/api/applications${query ? "?" + query : ""}`,
    );
  }

  getApplication(name: string): Promise<Application> {
    return this.request<Application>(
      "GET",
      `/api/applications/${encodeURIComponent(name)}`,
    );
  }

  createApplication(data: CreateApplicationRequest): Promise<Application> {
    return this.request<Application>("POST", "/api/applications", data);
  }

  updateApplication(
    name: string,
    data: UpdateApplicationRequest,
  ): Promise<Application> {
    return this.request<Application>(
      "PATCH",
      `/api/applications/${encodeURIComponent(name)}`,
      data,
    );
  }

  bulkUpdateApplications(req: BulkUpdateRequest): Promise<BulkUpdateResponse> {
    return this.request<BulkUpdateResponse>("PATCH", "/api/applications", req);
  }

  exportApplications(format: "json" | "csv" = "json"): Promise<Blob> {
    return this.requestBlob("GET", `/api/applications/export?format=${format}`);
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  getNotes(name: string): Promise<string> {
    return this.request<{ content: string }>(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/notes`,
    ).then((r) => r.content);
  }

  updateNotes(name: string, content: string): Promise<void> {
    return this.request<OKResponse>(
      "PUT",
      `/api/applications/${encodeURIComponent(name)}/notes`,
      { content },
    ).then(() => undefined);
  }

  listNoteVersions(name: string): Promise<NoteVersion[]> {
    return this.request<NoteVersion[]>(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/notes/versions`,
    );
  }

  getNoteVersion(name: string, filename: string): Promise<string> {
    return this.requestText(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/notes/versions/${encodeURIComponent(filename)}`,
    );
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  uploadFile(
    name: string,
    filename: string,
    data: Blob,
  ): Promise<{ filename: string; size: number }> {
    const form = new FormData();
    form.append("file", data, filename);
    return fetch(
      `${this.baseUrl}/api/applications/${encodeURIComponent(name)}/files`,
      {
        method: "POST",
        headers: { "X-API-Key": this.apiKey },
        body: form,
      },
    ).then(async (resp) => {
      if (!resp.ok) throw new CvApiError(resp.status, resp.statusText);
      return resp.json() as Promise<UploadResponse & { size: number }>;
    });
  }

  getFile(name: string, filename: string): Promise<Blob> {
    return this.requestBlob(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/files/${encodeURIComponent(filename)}`,
    );
  }

  // ── Intelligence ──────────────────────────────────────────────────────────

  skillsGap(name: string): Promise<SkillsGapResponse> {
    return this.request<SkillsGapResponse>(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/skills-gap`,
    );
  }

  healthAudit(name: string): Promise<HealthAuditResponse> {
    return this.request<HealthAuditResponse>(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/health-audit`,
    );
  }

  healthAuditHistory(name: string): Promise<HealthAuditHistoryResponse> {
    return this.request<HealthAuditHistoryResponse>(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/health-audit/history`,
    );
  }

  previewPDF(name: string, theme: string): Promise<Blob> {
    return this.requestBlob(
      "GET",
      `/api/applications/${encodeURIComponent(name)}/preview?theme=${encodeURIComponent(theme)}`,
    );
  }

  // ── Search ────────────────────────────────────────────────────────────────

  search(query: string, limit?: number): Promise<SearchResponse> {
    const qs = new URLSearchParams({ q: query });
    if (limit !== undefined) qs.set("limit", String(limit));
    return this.request<SearchResponse>("GET", `/api/search?${qs}`);
  }

  // ── Themes ────────────────────────────────────────────────────────────────

  listThemes(): Promise<Theme[]> {
    return this.request<Theme[]>("GET", "/api/themes");
  }

  // ── Dashboard & Stats ─────────────────────────────────────────────────────

  getDashboard(): Promise<DashboardResponse> {
    return this.request<DashboardResponse>("GET", "/api/dashboard");
  }

  getStats(): Promise<StatsData> {
    return this.request<StatsData>("GET", "/api/stats");
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  getSettings(): Promise<Settings> {
    return this.request<Settings>("GET", "/api/settings");
  }

  updateSettings(data: Partial<Settings>): Promise<Settings> {
    return this.request<Settings>("PUT", "/api/settings", data);
  }

  // ── Targets ───────────────────────────────────────────────────────────────

  listTargets(): Promise<Target[]> {
    return this.request<Target[]>("GET", "/api/targets");
  }

  // ── Actions (generic) ─────────────────────────────────────────────────────

  runAction(target: string, req: ActionRequest): Promise<ActionResult> {
    return this.request<ActionResult>(
      "POST",
      `/api/actions/${encodeURIComponent(target)}`,
      req,
    );
  }

  getJob(jobId: string): Promise<ActionResult> {
    return this.request<ActionResult>(
      "GET",
      `/api/actions/jobs/${encodeURIComponent(jobId)}`,
    );
  }

  // ── Streaming ─────────────────────────────────────────────────────────────

  /** SSE stream — yields WSMessage objects as they arrive. */
  async *streamAction(
    target: string,
    req: ActionRequest,
  ): AsyncGenerator<WSMessage> {
    const params = new URLSearchParams();
    if (req.application) params.set("app", req.application);
    if (req.args) {
      for (const [k, v] of Object.entries(req.args)) params.set(k, v);
    }

    const res = await fetch(
      `${this.baseUrl}/api/stream/${encodeURIComponent(target)}?${params}`,
      { headers: { "X-API-Key": this.apiKey } },
    );
    if (!res.ok || !res.body) {
      throw new CvApiError(res.status, `Stream failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (dataLine) yield JSON.parse(dataLine.slice(6)) as WSMessage;
      }
    }
  }

  // ── Sessions (admin) ──────────────────────────────────────────────────────

  listSessions(): Promise<Session[]> {
    return this.request<SessionListResponse>("GET", "/api/sessions").then(
      (r) => r.sessions,
    );
  }

  revokeSession(id: string): Promise<void> {
    return this.request<OKResponse>(
      "DELETE",
      `/api/sessions/${encodeURIComponent(id)}`,
    ).then(() => undefined);
  }

  // ── API Keys (admin) ──────────────────────────────────────────────────────

  listAPIKeys(): Promise<APIKeyInfo[]> {
    return this.request<APIKeyListResponse>("GET", "/api/api-keys").then(
      (r) => r.keys,
    );
  }

  generateAPIKey(role: "editor" | "viewer"): Promise<GenerateAPIKeyResponse> {
    return this.request<GenerateAPIKeyResponse>("POST", "/api/api-keys", { role });
  }

  revokeAPIKey(prefix: string): Promise<void> {
    return this.request<OKResponse>(
      "DELETE",
      `/api/api-keys/${encodeURIComponent(prefix)}`,
    ).then(() => undefined);
  }

  // ── Audit log (admin) ─────────────────────────────────────────────────────

  getAuditLog(limit?: number): Promise<AuditEntry[]> {
    const qs = limit !== undefined ? `?limit=${limit}` : "";
    return this.request<AuditEntry[]>("GET", `/api/audit-log${qs}`);
  }

  // ── Backup (admin) ────────────────────────────────────────────────────────

  downloadBackup(): Promise<Blob> {
    return this.requestBlob("GET", "/api/backup");
  }

  // ── CV-specific convenience methods ───────────────────────────────────────

  // Workflow

  applyToJob(url: string): Promise<ActionResult> {
    return this.runAction("apply", { args: { url } });
  }

  fetchJob(url: string): Promise<ActionResult> {
    return this.runAction("fetch", { args: { url } });
  }

  tailorCV(appName: string, ai?: string): Promise<ActionResult> {
    const args: Record<string, string> = { app: appName };
    if (ai !== undefined) args["ai"] = ai;
    return this.runAction("tailor", { application: appName, args });
  }

  scoreCV(appName: string): Promise<ActionResult> {
    return this.runAction("score", { application: appName, args: { app: appName } });
  }

  renderCV(appName: string): Promise<ActionResult> {
    return this.runAction("render", { application: appName, args: { app: appName } });
  }

  exportCVDocx(appName: string): Promise<ActionResult> {
    return this.runAction("docx", { application: appName, args: { app: appName } });
  }

  // Intelligence

  researchCompany(appName: string): Promise<ActionResult> {
    return this.runAction("research", { application: appName, args: { app: appName } });
  }

  findContacts(appName: string): Promise<ActionResult> {
    return this.runAction("contacts", { application: appName, args: { app: appName } });
  }

  analyzeJobFit(appName: string): Promise<ActionResult> {
    return this.runAction("job-fit", { application: appName, args: { app: appName } });
  }

  generateCoverAngles(appName: string): Promise<ActionResult> {
    return this.runAction("cover-angles", { application: appName, args: { app: appName } });
  }

  predictInterview(appName: string): Promise<ActionResult> {
    return this.runAction("predict", { application: appName, args: { app: appName } });
  }

  salaryBench(appName: string): Promise<ActionResult> {
    return this.runAction("salary-bench", { application: appName, args: { app: appName } });
  }

  // Interview

  prepInterview(appName: string): Promise<ActionResult> {
    return this.runAction("prep", { application: appName, args: { app: appName } });
  }

  prepSTAR(appName: string): Promise<ActionResult> {
    return this.runAction("prep-star", { application: appName, args: { app: appName } });
  }

  simulateInterview(appName: string): Promise<ActionResult> {
    return this.runAction("interview-sim", { application: appName, args: { app: appName } });
  }

  generateQuestions(appName: string): Promise<ActionResult> {
    return this.runAction("questions", { application: appName, args: { app: appName } });
  }

  // Outreach

  generateRecruiterEmail(appName: string): Promise<ActionResult> {
    return this.runAction("recruiter-email", { application: appName, args: { app: appName } });
  }

  generateCoverLetter(appName: string): Promise<ActionResult> {
    return this.runAction("ai-cover-letter", { application: appName, args: { app: appName } });
  }

  generateFollowUp(appName: string): Promise<ActionResult> {
    return this.runAction("followup", { application: appName, args: { app: appName } });
  }

  generateLinkedInMessage(appName: string): Promise<ActionResult> {
    return this.runAction("linkedin-message", { application: appName, args: { app: appName } });
  }

  // Reports

  getPipelineStats(): Promise<ActionResult> {
    return this.runAction("stats", {});
  }

  getPipelineDashboard(): Promise<ActionResult> {
    return this.runAction("dashboard", {});
  }

  getATSRanking(): Promise<ActionResult> {
    return this.runAction("ats-rank", {});
  }

  // Notifications

  sendDigest(): Promise<ActionResult> {
    return this.runAction("notify", {});
  }

  // Integrations

  syncNotion(appName: string): Promise<ActionResult> {
    return this.runAction("notion", { application: appName, args: { app: appName } });
  }

  pushToNotion(): Promise<ActionResult> {
    return this.runAction("notion-push", {});
  }

  pullFromNotion(): Promise<ActionResult> {
    return this.runAction("notion-pull", {});
  }
}

// Re-export types that callers commonly need alongside the client
export type {
  JobMatchRequest,
  JobMatchResponse,
  RestoreResponse,
};
