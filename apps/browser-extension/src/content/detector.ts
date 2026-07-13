/**
 * Detects whether the current page is a supported job posting.
 */

import { SITE_URL_PATTERNS } from "../lib/constants"
import type { JobSource } from "../lib/types"

export interface DetectionResult {
  detected: boolean
  source: JobSource | null
}

/**
 * Inspects the current window.location.href against known job board URL
 * patterns. Returns the matching source or null if not a job page.
 */
export function detectJobPage(url: string = window.location.href): DetectionResult {
  for (const [source, pattern] of Object.entries(SITE_URL_PATTERNS) as [
    JobSource,
    RegExp,
  ][]) {
    if (pattern.test(url)) {
      return { detected: true, source }
    }
  }
  return { detected: false, source: null }
}

/**
 * Waits for a DOM element to appear using MutationObserver.
 * Resolves with the element when found, or null after `timeoutMs`.
 */
export function waitForElement(
  selector: string,
  timeoutMs = 5000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector)
    if (existing) {
      resolve(existing)
      return
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeoutMs)
  })
}

/**
 * Tries each selector in order and returns the first matching element's
 * trimmed text content, or null if none match.
 */
export function queryText(selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (el?.textContent?.trim()) {
      return el.textContent.trim()
    }
  }
  return null
}

/**
 * Tries each selector in order and returns the first matching element,
 * or null if none match.
 */
export function queryElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (el) return el
  }
  return null
}
