import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// chrome.* is provided by tests/setup.ts
import { injectButton, cleanup } from "../src/content/injector"
import { BUTTON_ID, TOAST_ID } from "../src/lib/constants"

// Mock chrome.runtime.sendMessage for button click tests
const mockSendMessage = vi.fn().mockResolvedValue({ success: true })
vi.stubGlobal("chrome", {
  runtime: {
    sendMessage: mockSendMessage,
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    getURL: (path: string) => `chrome-extension://test/${path}`,
    lastError: null,
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  notifications: {
    create: vi.fn(),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupLinkedInDOM() {
  document.body.innerHTML = `
    <div class="jobs-s-apply">
      <button class="jobs-apply-button">Apply now</button>
    </div>
    <h1 class="t-24 t-bold inline">Senior Engineer</h1>
    <div class="job-details-jobs-unified-top-card__company-name">
      <a href="/company/acme">Acme Corp</a>
    </div>
    <div class="jobs-description__content jobs-box__html-content">
      <p>We are looking for an engineer.</p>
    </div>
  `
  Object.defineProperty(window, "location", {
    value: { href: "https://www.linkedin.com/jobs/view/1234567890/" },
    writable: true,
  })
}

function setupIndeedDOM() {
  document.body.innerHTML = `
    <div class="jobsearch-IndeedApplyButton-buttonWrapper">
      <button class="jobsearch-IndeedApplyButton">Apply</button>
    </div>
    <h1 class="jobsearch-JobInfoHeader-title">Data Engineer</h1>
    <div data-testid="inlineHeader-companyName">
      <a href="/cmp/big-data">Big Data Inc</a>
    </div>
    <div id="jobDescriptionText">
      <p>Join our data team.</p>
    </div>
  `
  Object.defineProperty(window, "location", {
    value: { href: "https://www.indeed.com/viewjob?jk=abc123" },
    writable: true,
  })
}

function setupWttjDOM() {
  document.body.innerHTML = `
    <div data-testid="apply-button">
      <a href="/apply">Apply now</a>
    </div>
    <h1 data-testid="job-title">Product Designer</h1>
    <a data-testid="company-link">Design Studio</a>
    <div data-testid="job-description">
      <p>Help us design amazing products.</p>
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
// injectButton — button creation and styling
// ---------------------------------------------------------------------------

describe("injectButton — button creation", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates a button with the correct ID", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn).not.toBeNull()
    expect(btn?.tagName).toBe("BUTTON")
  })

  it("applies inline styles to the button", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn?.getAttribute("style")).toContain("display: inline-flex")
    expect(btn?.getAttribute("style")).toContain("background: #7c3aed")
    expect(btn?.getAttribute("style")).toContain("color: #ffffff")
  })

  it("sets aria-label and title attributes", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn?.getAttribute("aria-label")).toBe("Add job to CV Pipeline")
    expect(btn?.getAttribute("title")).toBe("Add to CV Pipeline")
  })

  it("contains the 'Add to Pipeline' text", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn?.textContent).toContain("Add to Pipeline")
  })

  it("injects the keyframe animation style", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const style = document.getElementById("cv-pipeline-keyframes")
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain("@keyframes spin")
  })

  it("inserts the button after the anchor element", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const anchor = document.querySelector(".jobs-s-apply")
    const btn = document.getElementById(BUTTON_ID)
    expect(anchor?.nextElementSibling).toBe(btn)
  })
})

// ---------------------------------------------------------------------------
// injectButton — LinkedIn anchor
// ---------------------------------------------------------------------------

describe("injectButton — LinkedIn", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("finds and uses the .jobs-s-apply anchor", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn).not.toBeNull()

    const anchor = document.querySelector(".jobs-s-apply")
    expect(anchor?.nextElementSibling).toBe(btn)
  })

  it("injects button with correct purple background", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn?.getAttribute("style")).toContain("#7c3aed")
  })
})

// ---------------------------------------------------------------------------
// injectButton — Indeed anchor
// ---------------------------------------------------------------------------

describe("injectButton — Indeed", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("finds and uses the Indeed apply button wrapper", () => {
    setupIndeedDOM()
    injectButton("indeed")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn).not.toBeNull()

    const anchor = document.querySelector(".jobsearch-IndeedApplyButton-buttonWrapper")
    expect(anchor?.nextElementSibling).toBe(btn)
  })
})

// ---------------------------------------------------------------------------
// injectButton — WTTJ anchor
// ---------------------------------------------------------------------------

describe("injectButton — WTTJ", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("finds and uses the WTTJ apply button", () => {
    setupWttjDOM()
    injectButton("wttj")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn).not.toBeNull()

    const anchor = document.querySelector("[data-testid='apply-button']")
    expect(anchor?.nextElementSibling).toBe(btn)
  })
})

// ---------------------------------------------------------------------------
// injectButton — duplicate prevention
// ---------------------------------------------------------------------------

describe("injectButton — duplicate prevention", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("does not inject a second button if one already exists", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const firstBtn = document.getElementById(BUTTON_ID)
    expect(firstBtn).not.toBeNull()

    injectButton("linkedin")

    const buttons = document.querySelectorAll(`#${BUTTON_ID}`)
    expect(buttons.length).toBe(1)
  })

  it("does not inject a second keyframe style", () => {
    setupLinkedInDOM()
    injectButton("linkedin")
    injectButton("linkedin")

    const styles = document.querySelectorAll("#cv-pipeline-keyframes")
    expect(styles.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// injectButton — missing anchor (retry behavior)
// ---------------------------------------------------------------------------

describe("injectButton — missing anchor", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("schedules a retry when anchor is not found", () => {
    document.body.innerHTML = `<p>No anchor here</p>`

    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID)
    expect(btn).toBeNull()

    vi.advanceTimersByTime(1500)

    const btnAfter = document.getElementById(BUTTON_ID)
    expect(btnAfter).toBeNull()
  })

  it("injects button on retry when anchor appears", () => {
    document.body.innerHTML = `<p>No anchor yet</p>`

    injectButton("linkedin")

    document.body.innerHTML = `
      <div class="jobs-s-apply">
        <button class="jobs-apply-button">Apply</button>
      </div>
    `

    vi.advanceTimersByTime(1500)

    const btn = document.getElementById(BUTTON_ID)
    expect(btn).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// cleanup
// ---------------------------------------------------------------------------

describe("cleanup", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("removes the injected button", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    expect(document.getElementById(BUTTON_ID)).not.toBeNull()
    cleanup()
    expect(document.getElementById(BUTTON_ID)).toBeNull()
  })

  it("removes the toast if present", () => {
    const toast = document.createElement("div")
    toast.id = TOAST_ID
    document.body.appendChild(toast)

    expect(document.getElementById(TOAST_ID)).not.toBeNull()
    cleanup()
    expect(document.getElementById(TOAST_ID)).toBeNull()
  })

  it("does not throw when nothing to clean", () => {
    document.body.innerHTML = ""
    expect(() => cleanup()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Button hover behavior
// ---------------------------------------------------------------------------

describe("injectButton — hover behavior", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("changes background on mouseenter", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID) as HTMLButtonElement
    expect(btn).not.toBeNull()

    btn?.dispatchEvent(new MouseEvent("mouseenter"))
    expect(btn?.style.background).toMatch(/6d28d9|rgb\(109, 40, 217\)/)
  })

  it("restores background on mouseleave", () => {
    setupLinkedInDOM()
    injectButton("linkedin")

    const btn = document.getElementById(BUTTON_ID) as HTMLButtonElement
    expect(btn).not.toBeNull()

    btn?.dispatchEvent(new MouseEvent("mouseenter"))
    btn?.dispatchEvent(new MouseEvent("mouseleave"))
    expect(btn?.style.background).toMatch(/7c3aed|rgb\(124, 58, 237\)/)
  })
})
