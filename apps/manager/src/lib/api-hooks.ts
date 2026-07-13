"use client"

/**
 * React Query hooks for cv-api data.
 *
 * These hooks call the Next.js API routes (not cv-api directly), so they are
 * safe to use in client components. The server-side API routes do the actual
 * cv-api calls via api-client.ts.
 *
 * Stale time defaults:
 *  - Dashboard / Stats: 30 s (frequently changing data)
 *  - Applications list: 30 s
 *  - Single application: 60 s
 *  - Targets / Settings: 5 min (rarely changes)
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import type {
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
  JobMatchResponse,
  SearchResponse,
  Settings,
  StatsData,
  Target,
} from "./api-types"
import { ApiError, ApiErrorBody } from "./api-types"

// ---------------------------------------------------------------------------
// Internal fetch helper — calls Next.js API routes
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let body: ApiErrorBody
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      body = { code: response.status, message: response.statusText }
    }
    throw new ApiError(response.status, body)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Query key factory — keeps keys consistent and avoids typos
// ---------------------------------------------------------------------------

export const queryKeys = {
  applications: (status?: string) =>
    status ? ["applications", { status }] : ["applications"],
  application: (name: string) => ["applications", name],
  dashboard: () => ["dashboard"],
  stats: () => ["stats"],
  targets: () => ["targets"],
  settings: () => ["settings"],
  notes: (name: string) => ["applications", name, "notes"],
  skillsGap: (name: string) => ["applications", name, "skills-gap"],
  tags: (name: string) => ["applications", name, "tags"],
  atsScores: (name: string) => ["applications", name, "ats-scores"],
  preferences: (name: string) => ["applications", name, "preferences"],
  jobMatch: (name: string) => ["applications", name, "job-match"],
  actionHistory: () => ["action-history"],
} as const

// ---------------------------------------------------------------------------
// Hooks — read
// ---------------------------------------------------------------------------

export function useApplications(
  status?: string
): UseQueryResult<Application[], ApiError> {
  return useQuery<Application[], ApiError>({
    queryKey: queryKeys.applications(status),
    queryFn: () => {
      const url = new URL("/api/applications/list", window.location.origin)
      if (status) url.searchParams.set("status", status)
      return apiFetch<Application[]>(url.toString())
    },
    staleTime: 30_000,
    retry: (failureCount, error) => {
      // Do not retry on 401/403/404
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useApplication(
  name: string
): UseQueryResult<Application, ApiError> {
  return useQuery<Application, ApiError>({
    queryKey: queryKeys.application(name),
    queryFn: () =>
      apiFetch<Application>(`/api/applications/${encodeURIComponent(name)}`),
    staleTime: 60_000,
    enabled: name.length > 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useDashboard(): UseQueryResult<DashboardData, ApiError> {
  return useQuery<DashboardData, ApiError>({
    queryKey: queryKeys.dashboard(),
    queryFn: () => apiFetch<DashboardData>("/api/dashboard"),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useStats(): UseQueryResult<StatsData, ApiError> {
  return useQuery<StatsData, ApiError>({
    queryKey: queryKeys.stats(),
    queryFn: () => apiFetch<StatsData>("/api/stats"),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useTargets(): UseQueryResult<Target[], ApiError> {
  return useQuery<Target[], ApiError>({
    queryKey: queryKeys.targets(),
    queryFn: () => apiFetch<Target[]>("/api/targets"),
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useSettings(): UseQueryResult<Settings, ApiError> {
  return useQuery<Settings, ApiError>({
    queryKey: queryKeys.settings(),
    queryFn: () => apiFetch<Settings>("/api/settings"),
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

// ---------------------------------------------------------------------------
// Hooks — mutations
// ---------------------------------------------------------------------------

export function useMutateApplication(): UseMutationResult<
  Application,
  ApiError,
  CreateApplicationRequest
> {
  const qc = useQueryClient()

  return useMutation<Application, ApiError, CreateApplicationRequest>({
    mutationFn: (data) =>
      apiFetch<Application>("/api/applications", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate the full applications list so any filtered view refreshes
      void qc.invalidateQueries({ queryKey: ["applications"] })
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard() })
    },
  })
}

export interface ExecuteActionVars {
  target: string
  application?: string
  args?: Record<string, string>
}

export function useExecuteAction(): UseMutationResult<
  ActionResult,
  ApiError,
  ExecuteActionVars
> {
  return useMutation<ActionResult, ApiError, ExecuteActionVars>({
    mutationFn: ({ target, application, args }) =>
      apiFetch<ActionResult>(`/api/actions/${encodeURIComponent(target)}`, {
        method: "POST",
        body: JSON.stringify({ target, application, args }),
      }),
    // Actions are fire-and-forget from the hook's perspective;
    // callers poll getActionStatus or use the WebSocket stream.
    retry: false,
  })
}

export function useUpdateSettings(): UseMutationResult<
  Settings,
  ApiError,
  Settings
> {
  const qc = useQueryClient()

  return useMutation<Settings, ApiError, Settings>({
    mutationFn: (settings) =>
      apiFetch<Settings>("/api/settings", {
        method: "POST",
        body: JSON.stringify(settings),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.settings(), updated)
    },
  })
}

export function useNotes(name: string): UseQueryResult<{ content: string }, ApiError> {
  return useQuery<{ content: string }, ApiError>({
    queryKey: queryKeys.notes(name),
    queryFn: () => apiFetch<{ content: string }>(`/api/applications/${encodeURIComponent(name)}/notes`),
    staleTime: 60_000,
    enabled: name.length > 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useSkillsGap(name: string): UseQueryResult<{ missing: string[]; present: string[] }, ApiError> {
  return useQuery<{ missing: string[]; present: string[] }, ApiError>({
    queryKey: queryKeys.skillsGap(name),
    queryFn: () => apiFetch<{ missing: string[]; present: string[] }>(`/api/applications/${encodeURIComponent(name)}/skills-gap`),
    staleTime: 5 * 60_000,
    enabled: name.length > 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export interface UpdateApplicationVars {
  name: string
  data: { status?: string; company?: string; position?: string; followup_date?: string; deadline?: string }
}

interface UpdateApplicationContext {
  previousApp: Application | undefined
  previousList: Application[] | undefined
}

export function useUpdateApplication(): UseMutationResult<
  Application,
  ApiError,
  UpdateApplicationVars,
  UpdateApplicationContext
> {
  const qc = useQueryClient()
  return useMutation<Application, ApiError, UpdateApplicationVars, UpdateApplicationContext>({
    mutationFn: ({ name, data }) =>
      apiFetch<Application>(`/api/applications/${encodeURIComponent(name)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onMutate: async ({ name, data }) => {
      // Cancel any in-flight refetches so they do not overwrite the optimistic update
      await qc.cancelQueries({ queryKey: queryKeys.application(name) })
      await qc.cancelQueries({ queryKey: ["applications"] })

      // Snapshot current values for rollback
      const previousApp = qc.getQueryData<Application>(queryKeys.application(name))
      const previousList = qc.getQueryData<Application[]>(queryKeys.applications())

      // Optimistically update the single-application cache
      qc.setQueryData<Application>(queryKeys.application(name), (old) =>
        old ? { ...old, ...(data as Partial<Application>) } : old
      )

      // Optimistically update every status-filtered list that is currently cached.
      // We patch the unfiltered list plus, if the data carries a status change, the
      // target status list so the item appears immediately under its new bucket.
      const statusesToPatch = new Set<string | undefined>([undefined])
      if (data.status) statusesToPatch.add(data.status)

      for (const s of statusesToPatch) {
        qc.setQueryData<Application[]>(queryKeys.applications(s), (old) =>
          old?.map((app) => (app.name === name ? { ...app, ...(data as Partial<Application>) } : app))
        )
      }

      return { previousApp, previousList }
    },
    onError: (_err, variables, context) => {
      // Roll back to the snapshots captured in onMutate
      if (context?.previousApp !== undefined) {
        qc.setQueryData(queryKeys.application(variables.name), context.previousApp)
      }
      if (context?.previousList !== undefined) {
        qc.setQueryData(queryKeys.applications(), context.previousList)
      }
    },
    onSettled: (_data, _err, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.application(variables.name) })
      void qc.invalidateQueries({ queryKey: ["applications"] })
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard() })
    },
  })
}

export interface UpdateNotesVars {
  name: string
  content: string
}

export function useUpdateNotes(): UseMutationResult<{ ok: boolean }, ApiError, UpdateNotesVars> {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, ApiError, UpdateNotesVars>({
    mutationFn: ({ name, content }) =>
      apiFetch<{ ok: boolean }>(`/api/applications/${encodeURIComponent(name)}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.notes(variables.name) })
    },
  })
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export function useHealth(): UseQueryResult<{ status: "ok" | "degraded" | "down" }, Error> {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ status: "ok" | "degraded" | "down" }>("/api/health"),
    staleTime: 60_000,
    retry: false,
  })
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function useSearch(query: string): UseQueryResult<SearchResponse, ApiError> {
  return useQuery<SearchResponse, ApiError>({
    queryKey: ["search", query],
    queryFn: () => {
      const url = new URL("/api/search", window.location.origin)
      url.searchParams.set("q", query)
      return apiFetch<SearchResponse>(url.toString())
    },
    staleTime: 30_000,
    enabled: query.length >= 2,
    retry: false,
  })
}

// ---------------------------------------------------------------------------
// Hooks — Tags
// ---------------------------------------------------------------------------

export function useTags(name: string): UseQueryResult<AppTagsResponse, ApiError> {
  return useQuery<AppTagsResponse, ApiError>({
    queryKey: queryKeys.tags(name),
    queryFn: () => apiFetch<AppTagsResponse>(`/api/applications/${encodeURIComponent(name)}/tags`),
    staleTime: 60_000,
    enabled: name.length > 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useUpdateTags(): UseMutationResult<{ ok: boolean }, ApiError, { name: string; tags: string[] }> {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, ApiError, { name: string; tags: string[] }>({
    mutationFn: ({ name, tags }) =>
      apiFetch<{ ok: boolean }>(`/api/applications/${encodeURIComponent(name)}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tags }),
      }),
    onSuccess: (_data, { name }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tags(name) })
    },
  })
}

// ---------------------------------------------------------------------------
// Hooks — ATS Scores
// ---------------------------------------------------------------------------

export function useAtsScores(name: string): UseQueryResult<AtsHistoryResponse, ApiError> {
  return useQuery<AtsHistoryResponse, ApiError>({
    queryKey: queryKeys.atsScores(name),
    queryFn: () => apiFetch<AtsHistoryResponse>(`/api/applications/${encodeURIComponent(name)}/ats-scores`),
    staleTime: 60_000,
    enabled: name.length > 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useRecordAtsScore(): UseMutationResult<{ ok: boolean }, ApiError, { name: string; entry: AtsScoreEntry }> {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, ApiError, { name: string; entry: AtsScoreEntry }>({
    mutationFn: ({ name, entry }) =>
      apiFetch<{ ok: boolean }>(`/api/applications/${encodeURIComponent(name)}/ats-scores`, {
        method: "POST",
        body: JSON.stringify(entry),
      }),
    onSuccess: (_data, { name }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.atsScores(name) })
    },
  })
}

// ---------------------------------------------------------------------------
// Hooks — Preferences
// ---------------------------------------------------------------------------

export function usePreferences(name: string): UseQueryResult<AppPreferences, ApiError> {
  return useQuery<AppPreferences, ApiError>({
    queryKey: queryKeys.preferences(name),
    queryFn: () => apiFetch<AppPreferences>(`/api/applications/${encodeURIComponent(name)}/preferences`),
    staleTime: 60_000,
    enabled: name.length > 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useUpdatePreferences(): UseMutationResult<{ ok: boolean }, ApiError, { name: string; prefs: AppPreferencesUpdate }> {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, ApiError, { name: string; prefs: AppPreferencesUpdate }>({
    mutationFn: ({ name, prefs }) =>
      apiFetch<{ ok: boolean }>(`/api/applications/${encodeURIComponent(name)}/preferences`, {
        method: "PATCH",
        body: JSON.stringify(prefs),
      }),
    onSuccess: (_data, { name }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.preferences(name) })
    },
  })
}

// ---------------------------------------------------------------------------
// Hooks — Action History
// ---------------------------------------------------------------------------

export function useActionHistory(): UseQueryResult<ActionHistoryResponse, ApiError> {
  return useQuery<ActionHistoryResponse, ApiError>({
    queryKey: queryKeys.actionHistory(),
    queryFn: () => apiFetch<ActionHistoryResponse>("/api/action-history"),
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export function useRecordAction(): UseMutationResult<{ ok: boolean }, ApiError, Omit<ActionHistoryEntry, "lines">> {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, ApiError, Omit<ActionHistoryEntry, "lines">>({
    mutationFn: (entry) =>
      apiFetch<{ ok: boolean }>("/api/action-history", {
        method: "POST",
        body: JSON.stringify(entry),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.actionHistory() })
    },
  })
}

export function useClearActionHistory(): UseMutationResult<{ ok: boolean }, ApiError, void> {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, ApiError, void>({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>("/api/action-history", {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.actionHistory() })
    },
  })
}

// ---------------------------------------------------------------------------
// Hooks — Job Match
// ---------------------------------------------------------------------------

export function useJobMatch(name: string): UseQueryResult<JobMatchResponse | null, ApiError> {
  return useQuery<JobMatchResponse | null, ApiError>({
    queryKey: queryKeys.jobMatch(name),
    queryFn: () =>
      apiFetch<JobMatchResponse | null>(`/api/applications/${encodeURIComponent(name)}/match`),
    staleTime: 5 * 60_000,
    enabled: name.length > 0,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.statusCode < 500) return false
      return failureCount < 2
    },
  })
}

export interface RunJobMatchVars {
  name: string
  ai?: string
  threshold?: number
}

export function useRunJobMatch(): UseMutationResult<JobMatchResponse, ApiError, RunJobMatchVars> {
  const qc = useQueryClient()
  return useMutation<JobMatchResponse, ApiError, RunJobMatchVars>({
    mutationFn: ({ name, ai, threshold }) =>
      apiFetch<JobMatchResponse>(`/api/applications/${encodeURIComponent(name)}/match`, {
        method: "POST",
        body: JSON.stringify({ ai, threshold }),
      }),
    onSuccess: (_data, { name }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.jobMatch(name) })
    },
  })
}
