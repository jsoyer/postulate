import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("Search", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/search")
  })

  test("has search input", async ({ page }) => {
    const input = page.getByPlaceholder("Search job descriptions, prep notes, research\u2026")
    await expect(input).toBeVisible()
  })

  test("short query (1 char) does not show results", async ({ page }) => {
    const input = page.getByPlaceholder(/search job descriptions/i)
    await input.fill("a")
    // The page shows a "Type at least 3 characters" hint instead of results
    await expect(page.getByText(/type at least 3 characters/i)).toBeVisible()
    await expect(page.getByText("Acme Corp")).not.toBeVisible()
  })

  test("query of 3+ chars triggers search and shows 'Acme Corp'", async ({ page }) => {
    const input = page.getByPlaceholder(/search job descriptions/i)
    // Type 3+ characters to trigger the query (debounced at 300ms)
    await input.fill("acme")
    // Wait for debounce + network mock to resolve
    await expect(page.getByText("Acme Corp")).toBeVisible({ timeout: 2000 })
  })
})
