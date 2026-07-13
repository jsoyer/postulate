import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/")
  })

  test("shows total application count", async ({ page }) => {
    // KPI card for Total Applications shows "1"
    const kpiCard = page.getByText("Total Applications").locator("..")
    await expect(kpiCard.getByText("1")).toBeVisible()
  })

  test("shows recent applications list", async ({ page }) => {
    await expect(page.getByText("Recent Applications")).toBeVisible()
    await expect(page.getByText("Acme Corp")).toBeVisible()
    await expect(page.getByText("Senior Engineer")).toBeVisible()
  })

  test("shows 'By Stage' section", async ({ page }) => {
    await expect(page.getByText("Applications by Stage")).toBeVisible()
    // The mock data has 1 application in "applied" stage
    const stageSection = page.getByText("Applications by Stage").locator("..").locator("..")
    await expect(stageSection.getByText("applied")).toBeVisible()
  })

  test("KPI cards are visible", async ({ page }) => {
    await expect(page.getByText("Total Applications")).toBeVisible()
    await expect(page.getByText("Response Rate")).toBeVisible()
    await expect(page.getByText("Interview Rate")).toBeVisible()
    await expect(page.getByText("In Progress")).toBeVisible()
  })
})
