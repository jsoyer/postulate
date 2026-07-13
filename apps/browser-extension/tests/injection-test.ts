import { chromium } from "@playwright/test"
import { resolve } from "path"

const EXT_PATH = resolve(__dirname, "..", "dist")
const MOCK_HTML = resolve(__dirname, "mock-linkedin.html")

async function main() {
  console.log("Extension path:", EXT_PATH)

  const browser = await chromium.launchPersistentContext("/tmp/cv-ext-profile-2", {
    headless: true,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  })

  await new Promise((r) => setTimeout(r, 2000))

  const page = await browser.newPage()

  // Load mock LinkedIn page
  console.log("🔍 Loading mock LinkedIn job page...")
  await page.goto(`file://${MOCK_HTML}`, { waitUntil: "networkidle" })

  // Wait for content script to inject
  await new Promise((r) => setTimeout(r, 3000))

  // Check if button was injected
  const hasButton = await page.evaluate(() => {
    return !!document.querySelector('[data-cv-pipeline-btn]')
  })

  console.log("Button injected:", hasButton ? "✅ YES" : "❌ NO")

  // Check button text
  const buttonText = await page.evaluate(() => {
    const btn = document.querySelector('[data-cv-pipeline-btn]')
    return btn ? btn.textContent : null
  })

  console.log("Button text:", buttonText)

  // Take screenshot
  await page.screenshot({ path: "tests/screenshots/mock-linkedin-test.png" })
  console.log("📸 Screenshot saved")

  // Test extraction
  const extracted = await page.evaluate(() => {
    // Simulate what extractor does
    const titleEl = document.querySelector('.topcard__title')
    const companyEl = document.querySelector('.topcard__flavor span[aria-hidden="true"]')
    const descEl = document.querySelector('.show-more-less-html__markup')
    return {
      title: titleEl?.textContent?.trim(),
      company: companyEl?.textContent?.trim(),
      description: descEl?.textContent?.trim(),
    }
  })

  console.log("Extracted data:", JSON.stringify(extracted, null, 2))

  const pass = hasButton && extracted.title === "Senior Software Engineer" && extracted.company === "Acme Corp"
  console.log(pass ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED")

  await browser.close()
}

main().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
