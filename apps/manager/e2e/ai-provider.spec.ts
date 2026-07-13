import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("AI Provider", () => {
  test("tailor page shows AI Provider field", async ({ page }) => {
    await mockApi(page)
    await page.goto("/actions/tailor")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("AI Provider")).toBeVisible()
  })

  test("tailor page shows Model field", async ({ page }) => {
    await mockApi(page)
    await page.goto("/actions/tailor")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/model/i).first()).toBeVisible()
  })

  test("settings AI tab is clickable and shows Default AI Provider", async ({ page }) => {
    await mockApi(page)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")
    await page.getByRole("tab", { name: /^ai$/i }).click()
    await expect(page.getByText("Default AI Provider")).toBeVisible()
  })
})
