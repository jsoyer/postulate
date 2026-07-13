import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "../health/route"
import { setCvApiClient } from "@/lib/api-client"
import { CvApiClient } from "@/lib/api-client"

function mockClient(overrides: Partial<CvApiClient> = {}) {
  return {
    health: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as CvApiClient
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/health", () => {
  it("returns status ok when health check passes", async () => {
    setCvApiClient(mockClient({ health: vi.fn().mockResolvedValue(true) }))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ status: "ok" })
  })

  it("returns status degraded when health check returns false", async () => {
    setCvApiClient(mockClient({ health: vi.fn().mockResolvedValue(false) }))

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ status: "degraded" })
  })

  it("returns status down with 503 when client throws", async () => {
    setCvApiClient(
      mockClient({ health: vi.fn().mockRejectedValue(new Error("Connection refused")) })
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toMatchObject({ status: "down" })
  })
})
