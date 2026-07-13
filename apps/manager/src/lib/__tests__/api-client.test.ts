import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CvApiClient, getCvApiClient, setCvApiClient } from "@/lib/api-client"
import { ApiError } from "@/lib/api-types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:8000"
const API_KEY = "test-key"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CvApiClient", () => {
  let client: CvApiClient

  beforeEach(() => {
    client = new CvApiClient(BASE_URL, API_KEY)
    // Reset fetch mock before every test
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // getFileUrl
  // -------------------------------------------------------------------------

  describe("getFileUrl", () => {
    it("returns the correct URL without making a fetch call", () => {
      const url = client.getFileUrl("2025-01-acme", "cv.pdf")
      expect(url).toBe(
        "http://localhost:8000/api/applications/2025-01-acme/files/cv.pdf"
      )
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it("percent-encodes special characters in name and filename", () => {
      const url = client.getFileUrl("2025-01 acme", "my cv.pdf")
      expect(url).toBe(
        "http://localhost:8000/api/applications/2025-01%20acme/files/my%20cv.pdf"
      )
    })
  })

  // -------------------------------------------------------------------------
  // streamAction
  // -------------------------------------------------------------------------

  describe("streamAction", () => {
    it("creates a WebSocket with the correct ws:// URL, api_key and application params", () => {
      const MockWebSocket = vi.fn().mockImplementation(function (url: string) {
        return { url }
      })
      vi.stubGlobal("WebSocket", MockWebSocket)

      client.streamAction("tailor", "2025-01-acme")

      expect(MockWebSocket).toHaveBeenCalledOnce()
      const calledUrl = new URL(MockWebSocket.mock.calls[0][0] as string)
      expect(calledUrl.protocol).toBe("ws:")
      expect(calledUrl.pathname).toBe("/ws/actions/tailor")
      expect(calledUrl.searchParams.get("api_key")).toBe(API_KEY)
      expect(calledUrl.searchParams.get("application")).toBe("2025-01-acme")
    })

    it("upgrades https:// base URL to wss://", () => {
      const secureClient = new CvApiClient("https://cv-api.example.com", API_KEY)
      const MockWebSocket = vi.fn().mockImplementation(function (url: string) {
        return { url }
      })
      vi.stubGlobal("WebSocket", MockWebSocket)

      secureClient.streamAction("build")

      const calledUrl = new URL(MockWebSocket.mock.calls[0][0] as string)
      expect(calledUrl.protocol).toBe("wss:")
    })

    it("omits the application param when not provided", () => {
      const MockWebSocket = vi.fn().mockImplementation(function (url: string) {
        return { url }
      })
      vi.stubGlobal("WebSocket", MockWebSocket)

      client.streamAction("build")

      const calledUrl = new URL(MockWebSocket.mock.calls[0][0] as string)
      expect(calledUrl.searchParams.has("application")).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // health
  // -------------------------------------------------------------------------

  describe("health", () => {
    it("returns true when the response status is ok", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse({ status: "ok" })
      )
      const result = await client.health()
      expect(result).toBe(true)
    })

    it("returns false when the response status is not ok", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse({ status: "degraded" })
      )
      const result = await client.health()
      expect(result).toBe(false)
    })

    it("returns false when fetch throws", async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("Network error"))
      const result = await client.health()
      expect(result).toBe(false)
    })

    it("returns false when the server returns a non-2xx status", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse({ code: 503, message: "Service unavailable" }, 503)
      )
      const result = await client.health()
      expect(result).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // listApplications
  // -------------------------------------------------------------------------

  describe("listApplications", () => {
    it("makes a GET request with the X-API-Key header", async () => {
      const mockList = [
        { name: "2025-01-acme", company: "Acme", position: "Engineer", status: "applied", created_at: "2025-01-10T00:00:00Z" },
      ]
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(mockList))

      const result = await client.listApplications()

      expect(result).toEqual(mockList)
      expect(globalThis.fetch).toHaveBeenCalledOnce()

      const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
      const headers = init?.headers as Record<string, string>
      expect(headers["X-API-Key"]).toBe(API_KEY)
    })

    it("sends the status filter as a query param when provided", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse([]))

      await client.listApplications("interview")

      const [url] = vi.mocked(globalThis.fetch).mock.calls[0]
      expect(String(url)).toContain("status=interview")
    })

    it("uses GET method", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse([]))

      await client.listApplications()

      const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
      expect(init?.method).toBe("GET")
    })
  })

  // -------------------------------------------------------------------------
  // createApplication
  // -------------------------------------------------------------------------

  describe("createApplication", () => {
    it("makes a POST request with the correct JSON body", async () => {
      const created = { name: "2025-01-acme", company: "Acme", position: "Eng", status: "applied", created_at: "2025-01-10T00:00:00Z" }
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(created))

      const result = await client.createApplication({ company: "Acme", position: "Eng" })

      expect(result).toEqual(created)

      const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
      expect(init?.method).toBe("POST")
      expect(JSON.parse(init?.body as string)).toEqual({ company: "Acme", position: "Eng" })
    })

    it("includes the X-API-Key header", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse({ name: "x", company: "X", position: "Y", status: "applied", created_at: "" })
      )

      await client.createApplication({ company: "X", position: "Y" })

      const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]
      const headers = init?.headers as Record<string, string>
      expect(headers["X-API-Key"]).toBe(API_KEY)
    })
  })

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe("error propagation", () => {
    it("throws ApiError with statusCode 422 when cv-api returns 422", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse({ code: 422, message: "Unprocessable Entity" }, 422)
      )

      await expect(client.listApplications()).rejects.toThrow(ApiError)

      try {
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(
          makeResponse({ code: 422, message: "Unprocessable Entity" }, 422)
        )
        await client.listApplications()
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).statusCode).toBe(422)
        expect((err as ApiError).message).toBe("Unprocessable Entity")
      }
    })

    it("throws ApiError with statusCode 404 when resource not found", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        makeResponse({ code: 404, message: "Not found" }, 404)
      )

      try {
        await client.getApplication("nonexistent")
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).statusCode).toBe(404)
      }
    })

    it("falls back to statusText when error body is not parseable JSON", async () => {
      const badResponse = new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "text/plain" },
      })
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(badResponse)

      try {
        await client.listApplications()
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).statusCode).toBe(500)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Singleton helpers
  // -------------------------------------------------------------------------

  describe("setCvApiClient / getCvApiClient", () => {
    it("getCvApiClient returns the instance set by setCvApiClient", () => {
      const custom = new CvApiClient("http://custom:9000", "custom-key")
      setCvApiClient(custom)
      expect(getCvApiClient()).toBe(custom)
    })

    it("allows overriding the singleton multiple times", () => {
      const first = new CvApiClient("http://first:8000", "key-a")
      const second = new CvApiClient("http://second:8000", "key-b")

      setCvApiClient(first)
      expect(getCvApiClient()).toBe(first)

      setCvApiClient(second)
      expect(getCvApiClient()).toBe(second)
    })
  })
})
