import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("Settings - Advanced tab", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")
  })

  test("Advanced tab is visible", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /advanced/i })).toBeVisible()
  })

  test("clicking Advanced tab shows log level section", async ({ page }) => {
    await page.getByRole("tab", { name: /advanced/i }).click()
    await expect(page.getByText("Log Level")).toBeVisible()
  })

  test("clicking Advanced tab shows local data section", async ({ page }) => {
    await page.getByRole("tab", { name: /advanced/i }).click()
    await expect(page.getByText("Local Data")).toBeVisible()
    await expect(page.getByRole("button", { name: /clear all local data/i })).toBeVisible()
  })
})
