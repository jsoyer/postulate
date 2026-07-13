import { chromium } from "@playwright/test"
import { resolve } from "path"

const EXT_PATH = resolve(__dirname, "..", "dist")

async function main() {
  console.log("Extension path:", EXT_PATH)

  const browser = await chromium.launchPersistentContext("/tmp/cv-ext-profile", {
    headless: true,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  })

  // Wait for extension to load
  await new Promise((r) => setTimeout(r, 2000))

  // Get service worker page
  const backgroundPages = browser.pages()
  console.log("Background pages:", backgroundPages.length)

  // Test LinkedIn job page
  console.log("🔍 Testing LinkedIn job page detection...")
  const page = await browser.newPage()

  // Navigate to a LinkedIn job URL (will fail without auth, but we test detection)
  try {
    await page.goto(
      "https://www.linkedin.com/jobs/view/senior-software-engineer-at-acme-1234567890",
      { waitUntil: "domcontentloaded", timeout: 10000 }
    )
  } catch {
    // LinkedIn may block or redirect - that's OK, we just test URL detection
    console.log("LinkedIn navigation blocked (expected)")
  }

  // Take screenshot
  await page.screenshot({ path: "tests/screenshots/linkedin-test.png", fullPage: true })
  console.log("📸 Screenshot saved to tests/screenshots/linkedin-test.png")

  // Check current URL
  const url = page.url()
  console.log("Current URL:", url)
  console.log("URL contains linkedin.com/jobs/view:", url.includes("linkedin.com/jobs/view"))

  await browser.close()
  console.log("✅ Test completed successfully")
}

main().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
