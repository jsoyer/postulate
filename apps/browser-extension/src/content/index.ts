/**
 * Content script entry point.
 *
 * Runs on LinkedIn, Indeed, and Welcome to the Jungle pages.
 * Detects job postings and injects the "Add to CV Pipeline" button.
 * Handles SPA navigation by observing URL changes.
 */

import { detectJobPage, waitForElement } from "./detector"
import { cleanup, injectButton } from "./injector"
import { SELECTORS } from "../lib/constants"



// ---------------------------------------------------------------------------
// Main injection logic
// ---------------------------------------------------------------------------

async function tryInject(): Promise<void> {
  const { detected, source } = detectJobPage()

  if (!detected || !source) return

  // Wait for the job title to appear — confirms the page content has rendered
  const titleSelector = SELECTORS[source].jobTitle[0]
  await waitForElement(titleSelector ?? "h1", 8000)

  injectButton(source)
}

// ---------------------------------------------------------------------------
// SPA navigation — observe URL changes
// ---------------------------------------------------------------------------

let lastUrl = window.location.href

const navigationObserver = new MutationObserver(() => {
  const currentUrl = window.location.href
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl
    cleanup()
    // Slight delay for SPA frameworks to render the new page content
    setTimeout(() => void tryInject(), 800)
  }
})

navigationObserver.observe(document.body, {
  childList: true,
  subtree: true,
})

// ---------------------------------------------------------------------------
// Initial run
// ---------------------------------------------------------------------------

void tryInject()
