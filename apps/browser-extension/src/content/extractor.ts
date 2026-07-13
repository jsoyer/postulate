/**
 * Site-specific DOM extraction for LinkedIn, Indeed, and Welcome to the Jungle.
 */

import { SELECTORS } from "../lib/constants"
import { queryElement, queryText } from "./detector"
import type { JobData, JobSource } from "../lib/types"

// ---------------------------------------------------------------------------
// Per-site extractors
// ---------------------------------------------------------------------------

function extractLinkedIn(): Partial<JobData> {
  const sels = SELECTORS.linkedin

  const position = queryText(sels.jobTitle)
  const company = queryText(sels.company)

  // Description: prefer the full HTML, strip tags for plain text
  const descEl = queryElement(sels.description)
  const description = descEl ? descEl.textContent?.trim() ?? "" : ""

  return { position: position ?? "", company: company ?? "", description }
}

function extractIndeed(): Partial<JobData> {
  const sels = SELECTORS.indeed

  const position = queryText(sels.jobTitle)
  const company = queryText(sels.company)

  const descEl = queryElement(sels.description)
  const description = descEl ? descEl.textContent?.trim() ?? "" : ""

  return { position: position ?? "", company: company ?? "", description }
}

function extractWttj(): Partial<JobData> {
  const sels = SELECTORS.wttj

  const position = queryText(sels.jobTitle)
  const company = queryText(sels.company)

  const descEl = queryElement(sels.description)
  const description = descEl ? descEl.textContent?.trim() ?? "" : ""

  return { position: position ?? "", company: company ?? "", description }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts job data from the current page for the given source.
 * Returns null if required fields (company or position) cannot be found.
 */
export function extractJobData(source: JobSource): JobData | null {
  let partial: Partial<JobData>

  switch (source) {
    case "linkedin":
      partial = extractLinkedIn()
      break
    case "indeed":
      partial = extractIndeed()
      break
    case "wttj":
      partial = extractWttj()
      break
    default: {
      const _exhaustive: never = source
      throw new Error(`Unknown source: ${String(_exhaustive)}`)
    }
  }

  if (!partial.company?.trim() || !partial.position?.trim()) {
    return null
  }

  return {
    company: partial.company.trim(),
    position: partial.position.trim(),
    description: partial.description?.trim() ?? "",
    url: window.location.href,
    source,
  }
}

/**
 * Sanitizes extracted text: collapses whitespace and trims.
 */
export function sanitizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}
