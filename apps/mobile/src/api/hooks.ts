/**
 * React Query hooks for cv-api data fetching.
 *
 * Each hook creates a fresh CvApiClient via fromSecureConfig() inside the
 * query/mutation function — no global singleton needed.
 *
 * TODO: Add optimistic updates for status changes.
 * TODO: Add cache invalidation strategies.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CvApiClient } from "./client"
import type { ApplicationStatus, ActionRequest, CreateApplicationRequest } from "./types"

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  applications: ["applications"] as const,
  application: (name: string) => ["applications", name] as const,
  targets: ["targets"] as const,
  stats: ["stats"] as const,
} as const

// ---------------------------------------------------------------------------
// Application hooks
// ---------------------------------------------------------------------------

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: async () => {
      const client = await CvApiClient.fromSecureConfig()
      return client.listApplications()
    },
  })
}

export function useApplication(name: string) {
  return useQuery({
    queryKey: queryKeys.application(name),
    queryFn: async () => {
      const client = await CvApiClient.fromSecureConfig()
      return client.getApplication(name)
    },
  })
}

export function useCreateApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateApplicationRequest) => {
      const client = await CvApiClient.fromSecureConfig()
      return client.createApplication(req)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.applications })
    },
  })
}

export function useUpdateApplicationStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, status }: { name: string; status: ApplicationStatus }) => {
      const client = await CvApiClient.fromSecureConfig()
      return client.updateApplicationStatus(name, status)
    },
    onSuccess: (_data, { name }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.applications })
      void qc.invalidateQueries({ queryKey: queryKeys.application(name) })
    },
  })
}

export function useDeleteApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const client = await CvApiClient.fromSecureConfig()
      return client.deleteApplication(name)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.applications })
    },
  })
}

// ---------------------------------------------------------------------------
// Dashboard hook
// ---------------------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const client = await CvApiClient.fromSecureConfig()
      return client.getDashboard()
    },
  })
}

// ---------------------------------------------------------------------------
// Stats hook
// ---------------------------------------------------------------------------

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => {
      const client = await CvApiClient.fromSecureConfig()
      return client.getStats()
    },
  })
}

// ---------------------------------------------------------------------------
// Targets hook
// ---------------------------------------------------------------------------

export function useTargets() {
  return useQuery({
    queryKey: queryKeys.targets,
    queryFn: async () => {
      const client = await CvApiClient.fromSecureConfig()
      return client.listTargets()
    },
  })
}

// ---------------------------------------------------------------------------
// Action hook
// ---------------------------------------------------------------------------

export function useRunAction() {
  return useMutation({
    mutationFn: async (req: ActionRequest) => {
      const client = await CvApiClient.fromSecureConfig()
      return client.runAction(req)
    },
  })
}
