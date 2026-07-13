import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "../applications/list/route"
import { setCvApiClient } from "@/lib/api-client"
import { CvApiClient, ApiError } from "@/lib/api-client"
import type { Application } from "@/lib/api-types"

const sampleApps: Application[] = [
  {
    name: "2025-01-acme",
    company: "Acme",
    position: "Engineer",
    status: "applied",
    created_at: "2025-01-10T00:00:00Z",
  },
]

function makeRequest(url = "http://localhost:3000/api/applications/list"): Request {
  return new Request(url)
}

function mockClient(overrides: Partial<CvApiClient> = {}) {
  return {
    listApplications: vi.fn().mockResolvedValue(sampleApps),
    ...overrides,
  } as unknown as CvApiClient
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/applications/list", () => {
  it("returns applications array", async () => {
    setCvApiClient(mockClient())

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.applications).toHaveLength(1)
    expect(body.applications[0].company).toBe("Acme")
  })

  it("passes status query param to client", async () => {
    const listMock = vi.fn().mockResolvedValue([])
    setCvApiClient(mockClient({ listApplications: listMock }))

    await GET(makeRequest("http://localhost:3000/api/applications/list?status=interview"))

    expect(listMock).toHaveBeenCalledWith("interview")
  })

  it("returns 500 on unexpected error", async () => {
    setCvApiClient(
      mockClient({
        listApplications: vi.fn().mockRejectedValue(new Error("DB down")),
      })
    )

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  it("forwards ApiError status code", async () => {
    setCvApiClient(
      mockClient({
        listApplications: vi.fn().mockRejectedValue(
          new ApiError(503, { code: 503, message: "cv-api unavailable" })
        ),
      })
    )

    const res = await GET(makeRequest())
    expect(res.status).toBe(503)
  })
})
