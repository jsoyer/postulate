import { describe, it, expect, beforeEach } from "vitest"
import { extractJobData, sanitizeText } from "../src/content/extractor"

// ---------------------------------------------------------------------------
// Helpers to set up mock DOM for each site
// ---------------------------------------------------------------------------

function setupLinkedInDom(opts: {
  title?: string
  company?: string
  description?: string
}) {
  document.body.innerHTML = `
    <div>
      <h1 class="t-24 t-bold inline">${opts.title ?? "Senior Software Engineer"}</h1>
      <div class="job-details-jobs-unified-top-card__company-name">
        <a href="/company/acme">${opts.company ?? "Acme Corp"}</a>
      </div>
      <div class="jobs-description__content jobs-box__html-content">
        <p>${opts.description ?? "We are looking for an engineer to join our team."}</p>
      </div>
    </div>
  `
  // Mock window.location.href
  Object.defineProperty(window, "location", {
    value: { href: "https://www.linkedin.com/jobs/view/1234567890/" },
    writable: true,
  })
}

function setupIndeedDom(opts: {
  title?: string
  company?: string
  description?: string
}) {
  document.body.innerHTML = `
    <div>
      <h1 class="jobsearch-JobInfoHeader-title">${opts.title ?? "Data Engineer"}</h1>
      <div data-testid="inlineHeader-companyName">
        <a href="/cmp/big-data">${opts.company ?? "Big Data Inc"}</a>
      </div>
      <div id="jobDescriptionText">
        <p>${opts.description ?? "Join our data team and build pipelines at scale."}</p>
      </div>
    </div>
  `
  Object.defineProperty(window, "location", {
    value: { href: "https://www.indeed.com/viewjob?jk=abc123" },
    writable: true,
  })
}

function setupWttjDom(opts: {
  title?: string
  company?: string
  description?: string
}) {
  document.body.innerHTML = `
    <div>
      <h1 data-testid="job-title">${opts.title ?? "Product Designer"}</h1>
      <a data-testid="company-link">${opts.company ?? "Design Studio"}</a>
      <div data-testid="job-description">
        <p>${opts.description ?? "Help us design amazing products for our users."}</p>
      </div>
    </div>
  `
  Object.defineProperty(window, "location", {
    value: {
      href: "https://www.welcometothejungle.com/fr/companies/design-studio/jobs/product-designer",
    },
    writable: true,
  })
}

// ---------------------------------------------------------------------------
// extractJobData — LinkedIn
// ---------------------------------------------------------------------------

describe("extractJobData — linkedin", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("extracts company, position, description, url, and source", () => {
    setupLinkedInDom({})
    const result = extractJobData("linkedin")

    expect(result).not.toBeNull()
    expect(result?.company).toBe("Acme Corp")
    expect(result?.position).toBe("Senior Software Engineer")
    expect(result?.description).toContain("looking for an engineer")
    expect(result?.url).toBe("https://www.linkedin.com/jobs/view/1234567890/")
    expect(result?.source).toBe("linkedin")
  })

  it("returns null when job title is missing", () => {
    document.body.innerHTML = `
      <div>
        <div class="job-details-jobs-unified-top-card__company-name">
          <a href="/company/acme">Acme Corp</a>
        </div>
      </div>
    `
    const result = extractJobData("linkedin")
    expect(result).toBeNull()
  })

  it("returns null when company is missing", () => {
    document.body.innerHTML = `
      <div>
        <h1 class="t-24 t-bold inline">Senior Software Engineer</h1>
      </div>
    `
    const result = extractJobData("linkedin")
    expect(result).toBeNull()
  })

  it("extracts with empty description when description element is absent", () => {
    document.body.innerHTML = `
      <h1 class="t-24 t-bold inline">Backend Developer</h1>
      <div class="job-details-jobs-unified-top-card__company-name">
        <a>StartupXYZ</a>
      </div>
    `
    const result = extractJobData("linkedin")
    expect(result).not.toBeNull()
    expect(result?.description).toBe("")
  })

  it("trims whitespace from extracted values", () => {
    setupLinkedInDom({
      title: "  Lead Engineer  ",
      company: "  Trimmed Corp  ",
    })
    const result = extractJobData("linkedin")
    expect(result?.position).toBe("Lead Engineer")
    expect(result?.company).toBe("Trimmed Corp")
  })
})

// ---------------------------------------------------------------------------
// extractJobData — Indeed
// ---------------------------------------------------------------------------

describe("extractJobData — indeed", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("extracts all fields from an Indeed page", () => {
    setupIndeedDom({})
    const result = extractJobData("indeed")

    expect(result).not.toBeNull()
    expect(result?.company).toBe("Big Data Inc")
    expect(result?.position).toBe("Data Engineer")
    expect(result?.source).toBe("indeed")
  })

  it("returns null when both company and position are absent", () => {
    document.body.innerHTML = `<p>Nothing useful here</p>`
    const result = extractJobData("indeed")
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractJobData — Welcome to the Jungle
// ---------------------------------------------------------------------------

describe("extractJobData — wttj", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("extracts all fields from a WTTJ page", () => {
    setupWttjDom({})
    const result = extractJobData("wttj")

    expect(result).not.toBeNull()
    expect(result?.company).toBe("Design Studio")
    expect(result?.position).toBe("Product Designer")
    expect(result?.source).toBe("wttj")
  })
})

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------

describe("sanitizeText", () => {
  it("collapses multiple spaces into one", () => {
    expect(sanitizeText("hello   world")).toBe("hello world")
  })

  it("collapses newlines and tabs", () => {
    expect(sanitizeText("line1\n\nline2\t\tword")).toBe("line1 line2 word")
  })

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello")
  })

  it("returns empty string for all-whitespace input", () => {
    expect(sanitizeText("   \n\t  ")).toBe("")
  })

  it("leaves already-clean text unchanged", () => {
    expect(sanitizeText("clean text here")).toBe("clean text here")
  })
})
