import { test, expect } from "@playwright/test"
import { mockApi } from "./helpers/mock-api"

test.describe("Applications", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/applications")
  })

  test("shows applications table", async ({ page }) => {
    // Wait for loading to finish — the table header should be visible
    await expect(page.getByRole("columnheader", { name: /company/i })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: /position/i })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: /stage/i })).toBeVisible()
  })

  test("shows company name 'Acme Corp' in the list", async ({ page }) => {
    await expect(page.getByText("Acme Corp")).toBeVisible()
  })

  test("shows application status badge", async ({ page }) => {
    // The stage badge renders the text "applied" inside a Badge component
    const row = page.getByRole("row", { name: /acme corp/i })
    await expect(row.getByText("applied").first()).toBeVisible()
  })

  test("clicking an application row navigates to detail page", async ({ page }) => {
    // The "View" link in the table row navigates to /applications/2025-01-acme
    const viewLink = page.getByRole("link", { name: /view/i }).first()
    await viewLink.click()
    await expect(page).toHaveURL(/\/applications\/2025-01-acme/)
  })
})

test.describe("Create Application", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto("/applications/new")
  })

  test("form has company, position, URL fields", async ({ page }) => {
    await expect(page.getByLabel(/company/i)).toBeVisible()
    await expect(page.getByLabel(/position/i)).toBeVisible()
    // URL field label contains "Job URL"
    await expect(page.getByLabel(/job url/i)).toBeVisible()
  })

  test("submitting form with company + position navigates to applications list (mock POST)", async ({ page }) => {
    await page.getByLabel(/^company/i).fill("Test Corp")
    await page.getByLabel(/^position/i).fill("Software Engineer")
    await page.getByRole("button", { name: /create application/i }).click()
    // The mock POST returns APPLICATION_DETAIL with name "2025-01-acme"
    // onSuccess pushes to /applications/2025-01-acme
    await expect(page).toHaveURL(/\/applications\/2025-01-acme/)
  })

  test("shows validation error when company field is empty", async ({ page }) => {
    // Leave company empty, fill position, then submit
    await page.getByLabel(/^position/i).fill("Software Engineer")
    await page.getByRole("button", { name: /create application/i }).click()
    await expect(page.getByText(/company is required/i)).toBeVisible()
  })
})
