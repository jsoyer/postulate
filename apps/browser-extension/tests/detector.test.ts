import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { detectJobPage, queryText, queryElement, waitForElement } from "../src/content/detector"

// ---------------------------------------------------------------------------
// detectJobPage
// ---------------------------------------------------------------------------

describe("detectJobPage", () => {
  it("detects LinkedIn job view URLs", () => {
    const result = detectJobPage("https://www.linkedin.com/jobs/view/1234567890/")
    expect(result).toEqual({ detected: true, source: "linkedin" })
  })

  it("detects LinkedIn job view without trailing slash", () => {
    const result = detectJobPage("https://www.linkedin.com/jobs/view/9876543210")
    expect(result).toEqual({ detected: true, source: "linkedin" })
  })

  it("does NOT detect LinkedIn search pages", () => {
    const result = detectJobPage(
      "https://www.linkedin.com/jobs/search/?keywords=engineer"
    )
    expect(result).toEqual({ detected: false, source: null })
  })

  it("detects Indeed viewjob URLs", () => {
    const result = detectJobPage(
      "https://www.indeed.com/viewjob?jk=abc123&from=web"
    )
    expect(result).toEqual({ detected: true, source: "indeed" })
  })

  it("detects Indeed rc/clk redirect URLs", () => {
    const result = detectJobPage(
      "https://www.indeed.com/rc/clk?jk=abc123&fccid=xyz"
    )
    expect(result).toEqual({ detected: true, source: "indeed" })
  })

  it("does NOT detect Indeed search pages", () => {
    const result = detectJobPage(
      "https://www.indeed.com/jobs?q=software+engineer&l=Paris"
    )
    expect(result).toEqual({ detected: false, source: null })
  })

  it("detects Welcome to the Jungle job URLs", () => {
    const result = detectJobPage(
      "https://www.welcometothejungle.com/fr/companies/acme/jobs/software-engineer_paris"
    )
    expect(result).toEqual({ detected: true, source: "wttj" })
  })

  it("does NOT detect WTTJ company pages without /jobs/", () => {
    const result = detectJobPage(
      "https://www.welcometothejungle.com/fr/companies/acme"
    )
    expect(result).toEqual({ detected: false, source: null })
  })

  it("returns no detection for unrelated URLs", () => {
    const result = detectJobPage("https://github.com/some/repo")
    expect(result).toEqual({ detected: false, source: null })
  })

  it("returns no detection for empty string", () => {
    const result = detectJobPage("")
    expect(result).toEqual({ detected: false, source: null })
  })
})

// ---------------------------------------------------------------------------
// queryText — DOM helpers (requires jsdom)
// ---------------------------------------------------------------------------

describe("queryText", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("returns text content of the first matching selector", () => {
    document.body.innerHTML = `<h1 class="job-title">Senior Engineer</h1>`
    const result = queryText([".job-title", ".title"])
    expect(result).toBe("Senior Engineer")
  })

  it("falls through to the second selector when the first does not match", () => {
    document.body.innerHTML = `<h2 class="title">Product Manager</h2>`
    const result = queryText([".job-title", ".title"])
    expect(result).toBe("Product Manager")
  })

  it("returns null when no selector matches", () => {
    document.body.innerHTML = `<p>Nothing here</p>`
    const result = queryText([".job-title", ".title"])
    expect(result).toBeNull()
  })

  it("returns null when element exists but has empty text content", () => {
    document.body.innerHTML = `<h1 class="job-title">   </h1>`
    const result = queryText([".job-title"])
    expect(result).toBeNull()
  })

  it("trims surrounding whitespace from returned text", () => {
    document.body.innerHTML = `<h1 class="job-title">  Engineer  </h1>`
    const result = queryText([".job-title"])
    expect(result).toBe("Engineer")
  })
})

// ---------------------------------------------------------------------------
// queryElement
// ---------------------------------------------------------------------------

describe("queryElement", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("returns the first matching element", () => {
    document.body.innerHTML = `<button class="apply-btn">Apply</button>`
    const el = queryElement([".apply-btn", ".btn"])
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe("Apply")
  })

  it("falls through to the next selector", () => {
    document.body.innerHTML = `<button class="btn">Apply</button>`
    const el = queryElement([".apply-btn", ".btn"])
    expect(el?.className).toBe("btn")
  })

  it("returns null when no selector matches", () => {
    const el = queryElement([".apply-btn", ".btn"])
    expect(el).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// waitForElement
// ---------------------------------------------------------------------------

describe("waitForElement", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves immediately if element already exists", async () => {
    document.body.innerHTML = `<h1 class="title">Ready</h1>`
    const el = await waitForElement(".title", 1000)
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe("Ready")
  })

  it("resolves with null after timeout if element never appears", async () => {
    const promise = waitForElement(".never-appears", 100)
    vi.advanceTimersByTime(200)
    const el = await promise
    expect(el).toBeNull()
  })
})
