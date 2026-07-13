import { http, HttpResponse } from "msw"

const BASE_APPLICATION = {
  name: "2025-01-acme",
  company: "Acme",
  position: "Engineer",
  status: "applied" as const,
  created_at: "2025-01-10T00:00:00Z",
}

export const handlers = [
  // GET /api/applications/list — must come before /:name to avoid shadowing
  http.get("/api/applications/list", () => {
    return HttpResponse.json([BASE_APPLICATION])
  }),

  // GET /api/applications/:name/notes — more specific, before /:name catch-all
  http.get("/api/applications/:name/notes", () => {
    return HttpResponse.json({ content: "Some notes" })
  }),

  // POST /api/applications/:name/notes
  http.post("/api/applications/:name/notes", () => {
    return HttpResponse.json({ ok: true })
  }),

  // GET /api/applications/:name/skills-gap
  http.get("/api/applications/:name/skills-gap", () => {
    return HttpResponse.json({ missing: ["Kubernetes"], present: ["Docker"] })
  }),

  // GET /api/applications/:name — catch-all, after sub-path routes
  http.get("/api/applications/:name", ({ params }) => {
    const { name } = params
    return HttpResponse.json({
      ...BASE_APPLICATION,
      name: name as string,
    })
  }),

  // POST /api/applications
  http.post("/api/applications", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      {
        ...BASE_APPLICATION,
        company: (body.company as string) ?? BASE_APPLICATION.company,
        position: (body.position as string) ?? BASE_APPLICATION.position,
      },
      { status: 201 }
    )
  }),

  // PATCH /api/applications/:name
  http.patch("/api/applications/:name", async ({ params, request }) => {
    const { name } = params
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      ...BASE_APPLICATION,
      name: name as string,
      ...body,
    })
  }),

  // GET /api/dashboard
  http.get("/api/dashboard", () => {
    return HttpResponse.json({
      total_applications: 5,
      by_status: { applied: 3, interview: 1, offer: 1 },
      recent_applications: [],
    })
  }),

  // GET /api/stats
  http.get("/api/stats", () => {
    return HttpResponse.json({
      funnel: { applied: 5, interview: 2, offer: 1 },
      timeline: [{ date: "2025-01-01", count: 1 }],
    })
  }),

  // GET /api/targets
  http.get("/api/targets", () => {
    return HttpResponse.json([
      {
        name: "tailor",
        category: "CV",
        description: "AI tailor CV",
        args: ["application"],
      },
    ])
  }),

  // GET /api/settings
  http.get("/api/settings", () => {
    return HttpResponse.json({ theme: "dark", default_view: "list" })
  }),

  // POST /api/settings
  http.post("/api/settings", () => {
    return HttpResponse.json({ theme: "dark", default_view: "list" })
  }),

  // GET /api/health
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" })
  }),

  // GET /api/search
  http.get("/api/search", () => {
    return HttpResponse.json({
      results: [
        {
          name: "2025-01-acme",
          company: "Acme",
          position: "Engineer",
          stage: "applied",
          matches: [],
        },
      ],
    })
  }),
]
