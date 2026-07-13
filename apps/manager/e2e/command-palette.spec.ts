import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/")
  })

  test("opens on Ctrl+K", async ({ page }) => {
    await page.keyboard.press("Control+k")
    // The command palette input becomes visible
    await expect(page.getByPlaceholder("Search pages and actions...")).toBeVisible()
  })

  test("shows search input placeholder 'Search pages and actions...'", async ({ page }) => {
    await page.keyboard.press("Control+k")
    const input = page.getByPlaceholder("Search pages and actions...")
    await expect(input).toBeVisible()
  })

  test("filtering by 'Settings' shows the Settings item", async ({ page }) => {
    await page.keyboard.press("Control+k")
    const input = page.getByPlaceholder("Search pages and actions...")
    await input.fill("Settings")
    // The Settings item label should be visible in the results
    await expect(page.getByRole("option", { name: /settings/i }).first()).toBeVisible()
  })

  test("filtering by 'zzz' shows 'No results found.'", async ({ page }) => {
    await page.keyboard.press("Control+k")
    const input = page.getByPlaceholder("Search pages and actions...")
    await input.fill("zzz")
    await expect(page.getByText("No results found.")).toBeVisible()
  })

  test("pressing Escape closes the palette", async ({ page }) => {
    await page.keyboard.press("Control+k")
    await expect(page.getByPlaceholder("Search pages and actions...")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByPlaceholder("Search pages and actions...")).not.toBeVisible()
  })

  test("clicking 'Dashboard' item navigates to '/'", async ({ page }) => {
    // Navigate away first so we can verify the navigation back
    await page.goto("/applications")
    await page.keyboard.press("Control+k")
    const input = page.getByPlaceholder("Search pages and actions...")
    await input.fill("Dashboard")
    // Click the Dashboard option — cmdk renders items with role="option"
    await page.getByRole("option", { name: /dashboard/i }).first().click()
    await expect(page).toHaveURL("/")
  })
})
