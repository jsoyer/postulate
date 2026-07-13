import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("Batch Operations", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/applications")
    await page.waitForLoadState("networkidle")
  })

  test("applications table has checkboxes", async ({ page }) => {
    // The header checkbox (Select all) and the per-row checkboxes are rendered
    // once the table loads with data.
    await expect(page.getByRole("checkbox", { name: /select all/i })).toBeVisible()
    await expect(page.getByRole("checkbox", { name: /select acme corp/i })).toBeVisible()
  })

  test("selecting a checkbox shows batch action bar", async ({ page }) => {
    // Click the per-row checkbox for the mocked application
    await page.getByRole("checkbox", { name: /select acme corp/i }).click()
    // The sticky batch action bar appears with a selection count and action buttons
    await expect(page.getByText(/1 selected/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /ats score all/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /set stage/i })).toBeVisible()
  })
})
