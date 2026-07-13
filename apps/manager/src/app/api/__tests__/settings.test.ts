import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "../settings/route"
import { setCvApiClient } from "@/lib/api-client"
import { CvApiClient } from "@/lib/api-client"
import type { Settings } from "@/lib/api-types"

const sampleSettings: Settings = { theme: "dark", default_view: "list", pdfa_enabled: false }

function mockClient(overrides: Partial<CvApiClient> = {}) {
  return {
    getSettings: vi.fn().mockResolvedValue(sampleSettings),
    updateSettings: vi.fn().mockResolvedValue(sampleSettings),
    ...overrides,
  } as unknown as CvApiClient
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/settings", () => {
  it("returns settings object", async () => {
    setCvApiClient(mockClient())

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(sampleSettings)
  })

  it("returns 500 on error", async () => {
    setCvApiClient(
      mockClient({ getSettings: vi.fn().mockRejectedValue(new Error("fail")) })
    )

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe("POST /api/settings", () => {
  it("updates and returns settings", async () => {
    const updated: Settings = { theme: "light", default_view: "board", pdfa_enabled: true }
    const updateMock = vi.fn().mockResolvedValue(updated)
    setCvApiClient(mockClient({ updateSettings: updateMock }))

    const req = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(updated)
    expect(updateMock).toHaveBeenCalledWith(updated)
  })
})
