import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { describe, it, expect } from "vitest"
import {
  queryKeys,
  useApplications,
  useApplication,
  useDashboard,
  useHealth,
  useSearch,
  useMutateApplication,
  useUpdateApplication,
} from "@/lib/api-hooks"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    )
  }
}

// ---------------------------------------------------------------------------
// queryKeys
// ---------------------------------------------------------------------------

describe("queryKeys", () => {
  it("applications() returns ['applications']", () => {
    expect(queryKeys.applications()).toEqual(["applications"])
  })

  it("applications('applied') returns ['applications', { status: 'applied' }]", () => {
    expect(queryKeys.applications("applied")).toEqual([
      "applications",
      { status: "applied" },
    ])
  })

  it("application('acme') returns ['applications', 'acme']", () => {
    expect(queryKeys.application("acme")).toEqual(["applications", "acme"])
  })

  it("dashboard() returns ['dashboard']", () => {
    expect(queryKeys.dashboard()).toEqual(["dashboard"])
  })
})

// ---------------------------------------------------------------------------
// useApplications
// ---------------------------------------------------------------------------

describe("useApplications", () => {
  it("returns applications list on success", async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useApplications(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([
      {
        name: "2025-01-acme",
        company: "Acme",
        position: "Engineer",
        status: "applied",
        created_at: "2025-01-10T00:00:00Z",
      },
    ])
  })

  it("returns empty array gracefully when API returns []", async () => {
    // Override handler to return empty list for this test
    const { server } = await import("@/test/msw-server")
    const { http, HttpResponse } = await import("msw")

    server.use(
      http.get("/api/applications/list", () => HttpResponse.json([]))
    )

    const wrapper = createWrapper()
    const { result } = renderHook(() => useApplications(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// useApplication
// ---------------------------------------------------------------------------

describe("useApplication", () => {
  it("fetches application when name is non-empty", async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useApplication("2025-01-acme"), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toMatchObject({
      name: "2025-01-acme",
      company: "Acme",
    })
  })

  it("does NOT fetch when name is empty string", () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useApplication(""), { wrapper })

    // Query should remain idle / pending with fetchStatus idle because enabled: false
    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// useDashboard
// ---------------------------------------------------------------------------

describe("useDashboard", () => {
  it("returns total_applications, by_status, recent_applications", async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useDashboard(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toMatchObject({
      total_applications: 5,
      by_status: { applied: 3, interview: 1, offer: 1 },
      recent_applications: [],
    })
  })
})

// ---------------------------------------------------------------------------
// useHealth
// ---------------------------------------------------------------------------

describe("useHealth", () => {
  it("returns { status: 'ok' } on success", async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useHealth(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ status: "ok" })
  })
})

// ---------------------------------------------------------------------------
// useSearch
// ---------------------------------------------------------------------------

describe("useSearch", () => {
  it("does NOT fetch when query is < 2 chars", () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSearch("a"), { wrapper })

    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data).toBeUndefined()
  })

  it("does NOT fetch when query is empty string", () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSearch(""), { wrapper })

    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data).toBeUndefined()
  })

  it("fetches and returns results when query >= 2 chars", async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useSearch("ac"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.results).toHaveLength(1)
    expect(result.current.data?.results[0]).toMatchObject({
      name: "2025-01-acme",
      company: "Acme",
    })
  })
})

// ---------------------------------------------------------------------------
// useMutateApplication
// ---------------------------------------------------------------------------

describe("useMutateApplication", () => {
  it("triggers POST and resolves with created application", async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useMutateApplication(), { wrapper })

    result.current.mutate({ company: "Acme", position: "Eng" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toMatchObject({
      company: "Acme",
      position: "Eng",
    })
  })
})

// ---------------------------------------------------------------------------
// useUpdateApplication
// ---------------------------------------------------------------------------

describe("useUpdateApplication", () => {
  it("triggers PATCH and resolves with updated application", async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useUpdateApplication(), { wrapper })

    result.current.mutate({
      name: "2025-01-acme",
      data: { status: "interview" },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toMatchObject({
      name: "2025-01-acme",
      status: "interview",
    })
  })
})
