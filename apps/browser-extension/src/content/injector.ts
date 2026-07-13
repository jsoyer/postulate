/**
 * Injects the "Add to CV Pipeline" button and toast notifications onto
 * supported job pages. Manages its own DOM lifecycle to avoid duplicates
 * across SPA navigations.
 */

import { browser } from "../lib/browser"
import { BUTTON_ID, SELECTORS, TOAST_ID } from "../lib/constants"
import { queryElement } from "./detector"
import { extractJobData } from "./extractor"
import type { JobSource, AddToPipelinePayload, ExtensionMessage, PipelineProgressPayload } from "../lib/types"

// ---------------------------------------------------------------------------
// Button styles (injected inline — no Tailwind in content scripts)
// ---------------------------------------------------------------------------

const BUTTON_STYLE = `
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #7c3aed;
  color: #ffffff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
  line-height: 1;
  margin-left: 8px;
  vertical-align: middle;
`

const BUTTON_HOVER_BG = "#6d28d9"
const BUTTON_DEFAULT_BG = "#7c3aed"
const BUTTON_LOADING_BG = "#a78bfa"

// ---------------------------------------------------------------------------
// Debounce state — prevents rapid clicks from triggering multiple pipeline runs
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 10000
const lastClickTime = new Map<string, number>()

function isDebounced(key: string): boolean {
  const last = lastClickTime.get(key)
  if (last === undefined) return false
  return Date.now() - last < DEBOUNCE_MS
}

function recordClick(key: string): void {
  lastClickTime.set(key, Date.now())
}

// ---------------------------------------------------------------------------
// Toast styles
// ---------------------------------------------------------------------------

const TOAST_BASE_STYLE = `
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999999;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 4px 20px rgba(0,0,0,0.18);
  max-width: 360px;
  transition: opacity 0.25s ease, transform 0.25s ease;
  opacity: 0;
  transform: translateY(8px);
`

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

type ToastVariant = "info" | "success" | "error"

function showToast(message: string, variant: ToastVariant = "info"): void {
  // Remove any existing toast
  document.getElementById(TOAST_ID)?.remove()

  const colors: Record<ToastVariant, { bg: string; color: string }> = {
    info: { bg: "#1e1b4b", color: "#c4b5fd" },
    success: { bg: "#14532d", color: "#86efac" },
    error: { bg: "#450a0a", color: "#fca5a5" },
  }

  const icons: Record<ToastVariant, string> = {
    info: "⏳",
    success: "✓",
    error: "✕",
  }

  const { bg, color } = colors[variant]
  const toast = document.createElement("div")
  toast.id = TOAST_ID
  toast.setAttribute(
    "style",
    `${TOAST_BASE_STYLE} background: ${bg}; color: ${color};`
  )
  toast.innerHTML = `<span style="font-size:16px;">${icons[variant]}</span><span>${escapeHtml(message)}</span>`
  document.body.appendChild(toast)

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = "1"
      toast.style.transform = "translateY(0)"
    })
  })

  // Auto-dismiss
  const dismissAfter = variant === "error" ? 6000 : 4000
  setTimeout(() => {
    toast.style.opacity = "0"
    toast.style.transform = "translateY(8px)"
    setTimeout(() => toast.remove(), 300)
  }, dismissAfter)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ---------------------------------------------------------------------------
// Button creation
// ---------------------------------------------------------------------------

function createButton(): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.id = BUTTON_ID
  btn.setAttribute("style", BUTTON_STYLE)
  btn.setAttribute("aria-label", "Add job to CV Pipeline")
  btn.setAttribute("title", "Add to CV Pipeline")
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
    Add to Pipeline
  `

  btn.addEventListener("mouseenter", () => {
    btn.style.background = BUTTON_HOVER_BG
  })
  btn.addEventListener("mouseleave", () => {
    if (!btn.disabled) btn.style.background = BUTTON_DEFAULT_BG
  })

  return btn
}

// ---------------------------------------------------------------------------
// Pipeline trigger
// ---------------------------------------------------------------------------

function setButtonState(
  btn: HTMLButtonElement,
  state: "idle" | "loading" | "done" | "error"
): void {
  const labels: Record<typeof state, string> = {
    idle: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add to Pipeline
    `,
    loading: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
           style="animation: spin 1s linear infinite;">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Processing...
    `,
    done: "Added!",
    error: "Failed — retry",
  }

  btn.innerHTML = labels[state]
  btn.disabled = state === "loading"
  btn.style.background =
    state === "loading"
      ? BUTTON_LOADING_BG
      : state === "done"
        ? "#16a34a"
        : state === "error"
          ? "#dc2626"
          : BUTTON_DEFAULT_BG

  if (state === "done" || state === "error") {
    setTimeout(() => {
      btn.innerHTML = labels["idle"]
      btn.disabled = false
      btn.style.background = BUTTON_DEFAULT_BG
    }, 3000)
  }
}

async function handleAddToPipeline(
  btn: HTMLButtonElement,
  source: JobSource
): Promise<void> {
  const debounceKey = `${source}:${window.location.href}`
  if (isDebounced(debounceKey)) {
    showToast("Already processing — please wait...", "info")
    return
  }

  recordClick(debounceKey)
  setButtonState(btn, "loading")
  showToast("Extracting job data...", "info")

  const jobData = extractJobData(source)
  if (!jobData) {
    setButtonState(btn, "error")
    showToast(
      "Could not extract job data. The page may not have loaded fully.",
      "error"
    )
    return
  }

  showToast(`Adding "${jobData.position}" at ${jobData.company}...`, "info")

  const message: ExtensionMessage<AddToPipelinePayload> = {
    type: "ADD_TO_PIPELINE",
    payload: { job: jobData },
  }

  try {
    const response = await browser.runtime.sendMessage(message)

    if (response?.success) {
      setButtonState(btn, "done")
      showToast(
        `Pipeline started for ${jobData.company} — ${jobData.position}`,
        "success"
      )
    } else {
      setButtonState(btn, "error")
      showToast(
        response?.error ?? "Pipeline failed. Check extension options.",
        "error"
      )
    }
  } catch (err) {
    setButtonState(btn, "error")
    const message =
      err instanceof Error ? err.message : "Unknown error contacting extension."
    showToast(message, "error")
  }
}

// ---------------------------------------------------------------------------
// Listen for pipeline progress messages from the service worker
// ---------------------------------------------------------------------------

browser.runtime.onMessage.addListener((message: ExtensionMessage<PipelineProgressPayload>) => {
  if (message.type !== "PIPELINE_PROGRESS") return
  const payload = message.payload
  if (!payload) return

  const stepLabels: Record<NonNullable<typeof payload>["step"], string> = {
    creating: "Creating application...",
    uploading: "Uploading job description...",
    tailoring: "Tailoring CV (this may take a moment)...",
    done: "Done! CV tailored and PDF generated.",
  }

  const variant: ToastVariant =
    payload.step === "done" ? "success" : "info"
  showToast(payload.message ?? stepLabels[payload.step], variant)
})

// ---------------------------------------------------------------------------
// Injection
// ---------------------------------------------------------------------------

/**
 * Injects the button adjacent to the apply button for the detected site.
 * Safe to call multiple times — exits early if button already present.
 */
export function injectButton(source: JobSource): void {
  if (document.getElementById(BUTTON_ID)) return

  const sels = SELECTORS[source]
  const anchor = queryElement(sels.injectionAnchor)

  if (!anchor) {
    // Retry once after a short delay to handle lazy-rendered content
    setTimeout(() => injectButtonRetry(source), 1500)
    return
  }

  const btn = createButton()
  btn.addEventListener("click", () => void handleAddToPipeline(btn, source))

  // Insert after the anchor element
  anchor.insertAdjacentElement("afterend", btn)

  // Inject the spin keyframe animation once
  if (!document.getElementById("cv-pipeline-keyframes")) {
    const style = document.createElement("style")
    style.id = "cv-pipeline-keyframes"
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
  }
}

function injectButtonRetry(source: JobSource): void {
  if (document.getElementById(BUTTON_ID)) return

  const sels = SELECTORS[source]
  const anchor = queryElement(sels.injectionAnchor)
  if (!anchor) return

  const btn = createButton()
  btn.addEventListener("click", () => void handleAddToPipeline(btn, source))
  anchor.insertAdjacentElement("afterend", btn)
}

/**
 * Removes the injected button and toast from the page.
 * Called during SPA navigation to allow re-injection on the new page.
 */
export function cleanup(): void {
  document.getElementById(BUTTON_ID)?.remove()
  document.getElementById(TOAST_ID)?.remove()
}
