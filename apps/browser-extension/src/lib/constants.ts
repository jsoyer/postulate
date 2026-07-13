/**
 * Site configs, URL patterns, and DOM selectors for each supported job board.
 */

import type { JobSource } from "./types"

// ---------------------------------------------------------------------------
// URL patterns
// ---------------------------------------------------------------------------

export const SITE_URL_PATTERNS: Record<JobSource, RegExp> = {
  linkedin: /linkedin\.com\/jobs\/view\/\d+/,
  indeed: /indeed\.com\/(viewjob|rc\/clk)/,
  wttj: /welcometothejungle\.com\/[a-z-]+\/companies\/[^/]+\/jobs\//,
}

// ---------------------------------------------------------------------------
// DOM selectors per site
// ---------------------------------------------------------------------------

export interface SiteSelectors {
  jobTitle: string[]
  company: string[]
  description: string[]
  applyButton: string[]
  /** Where to inject the "Add to Pipeline" button */
  injectionAnchor: string[]
}

export const SELECTORS: Record<JobSource, SiteSelectors> = {
  linkedin: {
    jobTitle: [
      "h1.t-24.t-bold.inline",
      "h1.job-details-jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__job-title h1",
      ".jobs-unified-top-card__job-title",
      "h1[data-test-job-title]",
      ".jobs-details__main-content h1",
    ],
    company: [
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      "[data-test-employer-name]",
      ".jobs-details-top-card__company-url",
    ],
    description: [
      ".jobs-description__content .jobs-box__html-content",
      "#job-details",
      ".jobs-description-content__text",
      ".jobs-box__html-content",
      "[class*='job-description']",
    ],
    applyButton: [
      ".jobs-apply-button",
      ".jobs-s-apply button",
      "button[data-control-name='jobdetails_topcard_inapply']",
      ".jobs-apply-button--top-card",
      "[aria-label*='Apply']",
    ],
    injectionAnchor: [
      ".jobs-s-apply",
      ".jobs-apply-button",
      ".jobs-unified-top-card__content--two-pane .mt2",
      ".job-details-jobs-unified-top-card__top-buttons",
    ],
  },

  indeed: {
    jobTitle: [
      "h1.jobsearch-JobInfoHeader-title",
      "[data-testid='jobsearch-JobInfoHeader-title']",
      ".jobsearch-JobInfoHeader-title",
      "h1[class*='JobInfoHeader']",
    ],
    company: [
      "[data-testid='inlineHeader-companyName'] a",
      "[data-testid='inlineHeader-companyName']",
      ".jobsearch-InlineCompanyRating-companyHeader a",
      ".jobsearch-JobInfoHeader-companyNameSimple",
      "[class*='companyName'] a",
    ],
    description: [
      "#jobDescriptionText",
      "[id='jobDescriptionText']",
      ".jobsearch-jobDescriptionText",
      "[class*='JobDescription']",
    ],
    applyButton: [
      "#indeedApplyButton",
      ".jobsearch-IndeedApplyButton-newDesign",
      "[data-testid='indeedApplyButton']",
      "button[aria-label*='Apply']",
    ],
    injectionAnchor: [
      ".jobsearch-IndeedApplyButton-buttonWrapper",
      ".jobsearch-IndeedApplyButton",
      "#applyButtonLinkContainer",
      ".jobsearch-JobInfoHeader",
    ],
  },

  wttj: {
    jobTitle: [
      "h1[data-testid='job-title']",
      "h1.sc-cPiKLX",
      "h1[class*='JobTitle']",
      ".ais-Highlight h1",
      "main h1",
    ],
    company: [
      "[data-testid='company-name']",
      "a[data-testid='company-link']",
      ".sc-eFubAy a",
      "[class*='CompanyName'] a",
      ".hero a[href*='companies']",
    ],
    description: [
      "[data-testid='job-description']",
      ".ql-editor",
      "[class*='JobDescription']",
      "section[class*='description']",
      ".sc-fPXMVe",
    ],
    applyButton: [
      "a[data-testid='apply-button']",
      "button[data-testid='apply-button']",
      "[class*='ApplyButton']",
      "a[href*='/apply']",
    ],
    injectionAnchor: [
      "[data-testid='apply-button']",
      ".sc-bBABsx",
      "[class*='ApplySection']",
      "[class*='cta-container']",
    ],
  },
}

// ---------------------------------------------------------------------------
// Extension constants
// ---------------------------------------------------------------------------

export const EXTENSION_ID = "cv-pipeline-extension"
export const BUTTON_ID = "cv-pipeline-add-btn"
export const TOAST_ID = "cv-pipeline-toast"

export const DEFAULT_API_URL = "http://localhost:8080"

export const ALARM_NAMES = {
  BADGE_REFRESH: "badge-refresh",
  FOLLOWUP_CHECK: "followup-check",
  RETRY_CHECK: "retry-check",
} as const

export const ALARM_INTERVALS = {
  BADGE_REFRESH_MINUTES: 5,
  FOLLOWUP_CHECK_MINUTES: 60,
  RETRY_CHECK_MINUTES: 5,
} as const

export const STORAGE_KEYS = {
  SETTINGS: "cv_extension_settings",
  RECENT_APPLICATIONS: "cv_recent_applications",
  PENDING_JOBS: "cv_pending_jobs",
} as const

export const STATUS_COLORS: Record<string, string> = {
  applied: "#7c3aed",
  interview: "#0ea5e9",
  offer: "#16a34a",
  rejected: "#dc2626",
  ghosted: "#6b7280",
  running: "#f59e0b",
  completed: "#16a34a",
  failed: "#dc2626",
  cancelled: "#6b7280",
}
