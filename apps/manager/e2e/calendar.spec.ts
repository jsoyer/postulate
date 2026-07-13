import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/calendar")
    await page.waitForLoadState("networkidle")
  })

  test("shows current month and year heading", async ({ page }) => {
    const now = new Date()
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ]
    const expectedHeading = `${monthNames[now.getMonth()]} ${now.getFullYear()}`
    await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible()
  })

  test("Export iCal button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /export/i })).toBeVisible()
  })

  test("previous month button is present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /previous month/i })).toBeVisible()
  })

  test("next month button is present", async ({ page }) => {
    await expect(page.getByRole("button", { name: /next month/i })).toBeVisible()
  })
})
