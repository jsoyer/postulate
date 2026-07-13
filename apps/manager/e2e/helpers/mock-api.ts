import { Page } from "@playwright/test"

const APPLICATION = {
  name: "2025-01-acme",
  company: "Acme Corp",
  position: "Senior Engineer",
  status: "applied",
  stage: "applied",
  created: "2025-01-10",
  created_at: "2025-01-10T00:00:00Z",
  files: ["cv.pdf"],
}

const APPLICATION_DETAIL = {
  name: "2025-01-acme",
  company: "Acme Corp",
  position: "Senior Engineer",
  status: "applied",
  stage: "applied",
  created: "2025-01-10",
  created_at: "2025-01-10T00:00:00Z",
  files: { "cv.pdf": "cv.pdf" },
}

const DASHBOARD = {
  stats: {
    total: 1,
    byStage: { applied: 1 },
    responseRate: 0,
    interviewRate: 0,
  },
  applications: [
    {
      name: "2025-01-acme",
      company: "Acme Corp",
      position: "Senior Engineer",
      stage: "applied",
      created: "2025-01-10",
    },
  ],
  cvData: { name: "Test User" },
}

const STATS = {
  funnel: { applied: 1 },
  timeline: [{ date: "2025-01", count: 1 }],
}

const TARGETS = [
  { name: "tailor", category: "CV", description: "AI tailor", args: ["application"] },
]

const SETTINGS = { theme: "dark", default_view: "list" }

const SEARCH_RESULTS = {
  results: [
    {
      name: "2025-01-acme",
      company: "Acme Corp",
      position: "Senior Engineer",
      stage: "applied",
      matches: [{ file: "meta.yml", snippet: "Acme Corp" }],
    },
  ],
}

export async function mockApi(page: Page): Promise<void> {
  // Applications list
  await page.route("**/api/applications/list**", (route) => {
    route.fulfill({
      status: 200,
      json: { applications: [APPLICATION] },
    })
  })

  // Application detail (GET + PATCH)
  await page.route("**/api/applications/2025-01-acme", (route) => {
    route.fulfill({ status: 200, json: APPLICATION_DETAIL })
  })

  // Applications POST (create)
  await page.route("**/api/applications", (route) => {
    const method = route.request().method()
    if (method === "POST") {
      route.fulfill({ status: 201, json: APPLICATION_DETAIL })
    } else {
      route.fulfill({ status: 200, json: { applications: [APPLICATION] } })
    }
  })

  // Dashboard
  await page.route("**/api/dashboard", (route) => {
    route.fulfill({ status: 200, json: DASHBOARD })
  })

  // Stats
  await page.route("**/api/stats", (route) => {
    route.fulfill({ status: 200, json: STATS })
  })

  // Targets
  await page.route("**/api/targets", (route) => {
    route.fulfill({ status: 200, json: TARGETS })
  })

  // Health
  await page.route("**/api/health", (route) => {
    route.fulfill({ status: 200, json: { status: "ok" } })
  })

  // Settings
  await page.route("**/api/settings", (route) => {
    route.fulfill({ status: 200, json: SETTINGS })
  })

  // Search (must match wildcard for query string)
  await page.route("**/api/search**", (route) => {
    route.fulfill({ status: 200, json: SEARCH_RESULTS })
  })

  // Templates (used by new application page)
  await page.route("**/api/templates", (route) => {
    route.fulfill({ status: 200, json: [] })
  })
}
