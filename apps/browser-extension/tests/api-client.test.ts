import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CvApiClient, createClientFromStorage } from "../src/lib/api-client"
import { ApiError } from "../src/lib/types"

// ---------------------------------------------------------------------------
// Mock chrome.storage
// ---------------------------------------------------------------------------

vi.mock("../src/lib/storage", () => ({
  getSettings: vi.fn(),
}))

import { getSettings } from "../src/lib/storage"
const mockGetSettings = vi.mocked(getSettings)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.example.com"
const API_KEY = "test-key-123"

function makeClient() {
  return new CvApiClient(BASE_URL, API_KEY)
}

// ---------------------------------------------------------------------------
// CvApiClient — constructor
// ---------------------------------------------------------------------------

describe("CvApiClient — constructor", () => {
  it("strips trailing slash from baseUrl", () => {
    const client = new CvApiClient("https://api.example.com/", API_KEY)
    expect(client).toBeDefined()
  })

  it("accepts baseUrl without trailing slash", () => {
    const client = new CvApiClient(BASE_URL, API_KEY)
    expect(client).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — health / isHealthy
// ---------------------------------------------------------------------------

describe("CvApiClient — health", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns health data on 200", async () => {
    const mockResponse = { status: "ok", version: "1.0.0" }
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const client = makeClient()
    const result = await client.health()
    expect(result.status).toBe("ok")
    expect(result.version).toBe("1.0.0")
  })

  it("isHealthy returns true when status is ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "ok" }),
    } as Response)

    const client = makeClient()
    const result = await client.isHealthy()
    expect(result).toBe(true)
  })

  it("isHealthy returns false when status is degraded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "degraded" }),
    } as Response)

    const client = makeClient()
    const result = await client.isHealthy()
    expect(result).toBe(false)
  })

  it("isHealthy returns false on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"))

    const client = makeClient()
    const result = await client.isHealthy()
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — createApplication
// ---------------------------------------------------------------------------

describe("CvApiClient — createApplication", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates an application on POST success", async () => {
    const appData = { company: "Acme", position: "Engineer", url: "https://example.com" }
    const mockApp = {
      name: "acme-engineer",
      company: "Acme",
      position: "Engineer",
      status: "applied",
      created_at: "2024-01-01T00:00:00Z",
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockApp),
    } as Response)

    const client = makeClient()
    const result = await client.createApplication(appData)

    expect(result.name).toBe("acme-engineer")
    expect(result.company).toBe("Acme")

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(fetchCall?.[0]).toBe(`${BASE_URL}/api/applications`)
    expect(fetchCall?.[1]?.method).toBe("POST")
  })

  it("throws ApiError on 400", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ code: 400, message: "Invalid data" }),
    } as Response)

    const client = makeClient()
    await expect(
      client.createApplication({ company: "", position: "" })
    ).rejects.toThrow(ApiError)
  })

  it("throws ApiError on 500 with fallback message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("parse error")),
    } as Response)

    const client = makeClient()
    try {
      await client.createApplication({ company: "Acme", position: "Eng" })
      expect.fail("Expected ApiError")
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).statusCode).toBe(500)
    }
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — uploadFile
// ---------------------------------------------------------------------------

describe("CvApiClient — uploadFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uploads a file with FormData", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, filename: "job-description.txt" }),
    } as Response)

    const client = makeClient()
    const result = await client.uploadFile(
      "acme-engineer",
      "Job description content",
      "job-description.txt"
    )

    expect(result.ok).toBe(true)
    expect(result.filename).toBe("job-description.txt")

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(fetchCall?.[0]).toContain("/api/applications/acme-engineer/files")
    expect(fetchCall?.[1]?.method).toBe("POST")
  })

  it("throws ApiError on upload failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 413,
      statusText: "Payload Too Large",
      json: () => Promise.resolve({ code: 413, message: "File too large" }),
    } as Response)

    const client = makeClient()
    await expect(
      client.uploadFile("acme-engineer", "x".repeat(1000), "big.txt")
    ).rejects.toThrow(ApiError)
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — executeAction
// ---------------------------------------------------------------------------

describe("CvApiClient — executeAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("executes an action and returns result", async () => {
    const mockResult = {
      job_id: "job-123",
      target: "tailor",
      status: "running",
      exit_code: 0,
      duration_ms: 0,
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResult),
    } as Response)

    const client = makeClient()
    const result = await client.executeAction("tailor", "acme-engineer")

    expect(result.job_id).toBe("job-123")
    expect(result.status).toBe("running")

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(fetchCall?.[0]).toContain("/api/actions/tailor")
    expect(fetchCall?.[1]?.method).toBe("POST")
  })

  it("encodes special characters in target", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        job_id: "job-456",
        target: "custom/action",
        status: "running",
        exit_code: 0,
        duration_ms: 0,
      }),
    } as Response)

    const client = makeClient()
    await client.executeAction("custom/action", "app-name")

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(fetchCall?.[0]).toContain("/api/actions/custom%2Faction")
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — listApplications / getApplication
// ---------------------------------------------------------------------------

describe("CvApiClient — listApplications / getApplication", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("lists applications with optional status filter", async () => {
    const apps = [
      { name: "app-1", company: "Acme", position: "Eng", status: "applied", created_at: "2024-01-01" },
    ]

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(apps),
    } as Response)

    const client = makeClient()
    const result = await client.listApplications("applied")

    expect(result).toHaveLength(1)
    expect(result[0]!.company).toBe("Acme")

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(fetchCall?.[0]).toContain("status=applied")
  })

  it("gets a single application by name", async () => {
    const app = {
      name: "acme-engineer",
      company: "Acme",
      position: "Engineer",
      status: "applied",
      created_at: "2024-01-01",
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(app),
    } as Response)

    const client = makeClient()
    const result = await client.getApplication("acme-engineer")

    expect(result.name).toBe("acme-engineer")
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — getDashboard
// ---------------------------------------------------------------------------

describe("CvApiClient — getDashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns dashboard data", async () => {
    const dashboard = {
      total_applications: 5,
      by_status: { applied: 3, interview: 2 },
      recent_applications: [],
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(dashboard),
    } as Response)

    const client = makeClient()
    const result = await client.getDashboard()

    expect(result.total_applications).toBe(5)
    expect(result.by_status.applied).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — request headers
// ---------------------------------------------------------------------------

describe("CvApiClient — request headers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("includes X-API-Key header on every request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response)

    const client = makeClient()
    await client.listApplications()

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
    const headers = fetchCall?.[1]?.headers as Record<string, string> | undefined
    expect(headers?.["X-API-Key"]).toBe(API_KEY)
  })

  it("includes Content-Type and Accept headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response)

    const client = makeClient()
    await client.listApplications()

    const fetchCall2 = vi.mocked(globalThis.fetch).mock.calls[0]
    const headers2 = fetchCall2?.[1]?.headers as Record<string, string> | undefined
    expect(headers2?.["Content-Type"]).toBe("application/json")
    expect(headers2?.["Accept"]).toBe("application/json")
  })
})

// ---------------------------------------------------------------------------
// CvApiClient — error handling (401, 500, network)
// ---------------------------------------------------------------------------

describe("CvApiClient — error handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("throws ApiError on 401 unauthorized", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () => Promise.resolve({ code: 401, message: "Invalid API key" }),
    } as Response)

    const client = makeClient()
    try {
      await client.health()
      expect.fail("Expected ApiError")
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).statusCode).toBe(401)
    }
  })

  it("throws ApiError on 500 server error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ code: 500, message: "Server crashed" }),
    } as Response)

    const client = makeClient()
    try {
      await client.getDashboard()
      expect.fail("Expected ApiError")
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).statusCode).toBe(500)
    }
  })

  it("propagates network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"))

    const client = makeClient()
    await expect(client.health()).rejects.toThrow(TypeError)
  })

  it("handles 204 No Content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response)

    const client = makeClient()
    const result = await client.health()
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// createClientFromStorage
// ---------------------------------------------------------------------------

describe("createClientFromStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates a client when settings are configured", async () => {
    mockGetSettings.mockResolvedValueOnce({
      apiUrl: "https://api.example.com",
      apiKey: "secret-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    const client = await createClientFromStorage()
    expect(client).toBeInstanceOf(CvApiClient)
  })

  it("throws when apiUrl is missing", async () => {
    mockGetSettings.mockResolvedValueOnce({
      apiUrl: "",
      apiKey: "secret-key",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    await expect(createClientFromStorage()).rejects.toThrow(
      "cv-api URL is not configured"
    )
  })

  it("throws when apiKey is missing", async () => {
    mockGetSettings.mockResolvedValueOnce({
      apiUrl: "https://api.example.com",
      apiKey: "",
      theme: "dark",
      badgeEnabled: true,
      notificationsEnabled: true,
    })

    await expect(createClientFromStorage()).rejects.toThrow(
      "API key is not configured"
    )
  })
})
