/**
 * Manifest V3 background service worker.
 *
 * Responsibilities:
 * - Handle ADD_TO_PIPELINE messages from content scripts
 * - Orchestrate the pipeline: create app → upload job desc → tailor CV
 * - Manage badge count (pending/recent applications)
 * - Alarm-based follow-up reminders
 * - Push notifications for pipeline events
 */

import { createClientFromStorage } from "../lib/api-client"
import { ALARM_INTERVALS, ALARM_NAMES } from "../lib/constants"
import {
  addPendingJob,
  getPendingJobs,
  getRecentApplications,
  getSettings,
  prependApplication,
  removePendingJob,
  updatePendingJob,
} from "../lib/storage"
import type {
  AddToPipelinePayload,
  Application,
  ExtensionMessage,
  PendingJob,
  PipelineProgressPayload,
  PipelineResult,
} from "../lib/types"

const MAX_RETRIES = 5
const BACKOFF_INTERVALS_MS = [60_000, 300_000, 900_000, 3_600_000, 14_400_000]

// ---------------------------------------------------------------------------
// Badge management
// ---------------------------------------------------------------------------

async function updateBadge(): Promise<void> {
  const settings = await getSettings()
  if (!settings.badgeEnabled) {
    chrome.action.setBadgeText({ text: "" })
    return
  }

  try {
    const client = await createClientFromStorage()
    const apps = await client.listApplications("applied")
    const pending = await getPendingJobs()
    const activeCount = apps.length
    const pendingCount = pending.length

    let badgeText = ""
    if (activeCount > 0 && pendingCount > 0) {
      badgeText = `${activeCount}+${pendingCount}`
    } else if (activeCount > 0) {
      badgeText = String(activeCount)
    } else if (pendingCount > 0) {
      badgeText = `+${pendingCount}`
    }

    chrome.action.setBadgeText({ text: badgeText })
    chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" })
  } catch {
    chrome.action.setBadgeText({ text: "" })
  }
}

// ---------------------------------------------------------------------------
// Notification helper
// ---------------------------------------------------------------------------

function notify(
  title: string,
  message: string,
  type: chrome.notifications.TemplateType = "basic"
): void {
  const id = `cv-pipeline-${Date.now()}`
  chrome.notifications.create(id, {
    type,
    iconUrl: chrome.runtime.getURL("icons/icon-48.png"),
    title,
    message,
  })
}

// ---------------------------------------------------------------------------
// Send progress to active tabs matching job board patterns
// ---------------------------------------------------------------------------

async function sendProgressToTabs(payload: PipelineProgressPayload): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true })
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: "PIPELINE_PROGRESS",
          payload,
        } satisfies ExtensionMessage<PipelineProgressPayload>)
        .catch(() => {
          // Tab may not have content script — ignore
        })
    }
  }
}

// ---------------------------------------------------------------------------
// Pipeline orchestration
// ---------------------------------------------------------------------------

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true
  }
  if (err instanceof Error && err.message.includes("fetch")) {
    return true
  }
  return false
}

async function runPipeline(
  payload: AddToPipelinePayload
): Promise<PipelineResult> {
  const { job } = payload
  const client = await createClientFromStorage()

  // Step 1: Create application
  await sendProgressToTabs({ step: "creating", message: "Creating application..." })

  const application: Application = await client.createApplication({
    company: job.company,
    position: job.position,
    url: job.url,
  })

  await sendProgressToTabs({
    step: "uploading",
    applicationName: application.name,
    message: "Uploading job description...",
  })

  // Step 2: Upload job description as a file (job-description.txt)
  if (job.description) {
    await client.uploadFile(
      application.name,
      job.description,
      "job-description.txt"
    )
  }

  // Step 3: Trigger tailor action
  await sendProgressToTabs({
    step: "tailoring",
    applicationName: application.name,
    message: "Tailoring CV — this may take a moment...",
  })

  const actionResult = await client.executeAction(
    "tailor",
    application.name
  )

  // Step 4: Done
  await sendProgressToTabs({
    step: "done",
    applicationName: application.name,
    jobId: actionResult.job_id,
    message: `CV tailored for ${job.company}!`,
  })

  // Cache locally
  await prependApplication(application)

  return { application, jobId: actionResult.job_id }
}

async function runPipelineWithOfflineFallback(
  payload: AddToPipelinePayload
): Promise<{ success: boolean; result?: PipelineResult; savedOffline?: boolean }> {
  try {
    const result = await runPipeline(payload)
    return { success: true, result }
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      const pendingJob: PendingJob = {
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        job: payload.job,
        createdAt: Date.now(),
        retryCount: 0,
        lastError: err instanceof Error ? err.message : "Network error",
      }
      await addPendingJob(pendingJob)
      void updateBadge()

      notify(
        "API unreachable",
        `Job for ${payload.job.company} saved for retry`
      )

      return { success: false, savedOffline: true }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Follow-up reminder check
// ---------------------------------------------------------------------------

async function checkFollowups(): Promise<void> {
  const settings = await getSettings()
  if (!settings.notificationsEnabled) return

  try {
    const client = await createClientFromStorage()
    const apps = await client.listApplications("applied")

    const now = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    for (const app of apps) {
      const createdAt = new Date(app.created_at).getTime()
      if (now - createdAt > sevenDaysMs) {
        notify(
          "Follow-up reminder",
          `No update for "${app.position}" at ${app.company}. Consider following up.`
        )
        // Only notify the first stale application per check cycle
        break
      }
    }
  } catch {
    // API unreachable — skip silently
  }
}

// ---------------------------------------------------------------------------
// Pending jobs retry
// ---------------------------------------------------------------------------

async function retryPendingJobs(): Promise<void> {
  const pending = await getPendingJobs()
  if (pending.length === 0) return

  try {
    const client = await createClientFromStorage()
    const healthy = await client.isHealthy()
    if (!healthy) return
  } catch {
    return
  }

  let successCount = 0
  const toKeep: PendingJob[] = []

  for (const job of pending) {
    if (job.retryCount >= MAX_RETRIES) {
      continue
    }

    const backoffIdx = Math.min(job.retryCount, BACKOFF_INTERVALS_MS.length - 1)
    const backoffMs = BACKOFF_INTERVALS_MS[backoffIdx]!
    const timeSinceCreated = Date.now() - job.createdAt
    if (timeSinceCreated < backoffMs) {
      toKeep.push(job)
      continue
    }

    try {
      await runPipeline({ job: job.job })
      await removePendingJob(job.id)
      successCount++
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Retry failed"
      await updatePendingJob(job.id, {
        retryCount: job.retryCount + 1,
        lastError: errMsg,
      })
      toKeep.push({ ...job, retryCount: job.retryCount + 1, lastError: errMsg })
    }
  }

  if (successCount > 0) {
    notify(
      "Offline jobs retried",
      `${successCount} job${successCount > 1 ? "s" : ""} processed successfully`
    )
    void updateBadge()
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage<unknown>,
    _sender,
    sendResponse: (response: unknown) => void
  ) => {
    switch (message.type) {
      case "ADD_TO_PIPELINE": {
        const payload = message.payload as AddToPipelinePayload
        runPipelineWithOfflineFallback(payload)
          .then((result) => {
            if (result.success && result.result) {
              sendResponse({ success: true, result: result.result })
              void updateBadge()
              notify(
                "Pipeline started",
                `Application created for ${payload.job.position} at ${payload.job.company}`
              )
            } else if (result.savedOffline) {
              sendResponse({ success: false, savedOffline: true })
            } else {
              sendResponse({ success: false, error: "Pipeline failed" })
            }
          })
          .catch((err: unknown) => {
            const errMessage =
              err instanceof Error ? err.message : "Unknown error"
            sendResponse({ success: false, error: errMessage })
            notify("Pipeline failed", errMessage)
          })
        return true
      }

      case "GET_RECENT_APPLICATIONS": {
        getRecentApplications()
          .then((apps) => sendResponse({ success: true, apps }))
          .catch((err: unknown) => {
            sendResponse({ success: false, error: String(err) })
          })
        return true
      }

      case "CHECK_HEALTH": {
        createClientFromStorage()
          .then((client) => client.isHealthy())
          .then((healthy) => sendResponse({ healthy }))
          .catch(() => sendResponse({ healthy: false }))
        return true
      }

      case "GET_SETTINGS": {
        getSettings()
          .then((settings) => sendResponse({ success: true, settings }))
          .catch((err: unknown) => {
            sendResponse({ success: false, error: String(err) })
          })
        return true
      }

      case "RETRY_PENDING_JOBS": {
        retryPendingJobs()
          .then(() => getPendingJobs())
          .then((jobs) => sendResponse({ success: true, jobs }))
          .catch((err: unknown) => {
            sendResponse({ success: false, error: String(err) })
          })
        return true
      }

      case "GET_PENDING_JOBS": {
        getPendingJobs()
          .then((jobs) => sendResponse({ success: true, jobs }))
          .catch((err: unknown) => {
            sendResponse({ success: false, error: String(err) })
          })
        return true
      }

      default:
        return false
    }
  }
)

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAMES.BADGE_REFRESH) {
    void updateBadge()
  }
  if (alarm.name === ALARM_NAMES.FOLLOWUP_CHECK) {
    void checkFollowups()
  }
  if (alarm.name === ALARM_NAMES.RETRY_CHECK) {
    void retryPendingJobs()
  }
})

// ---------------------------------------------------------------------------
// Install / startup lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAMES.BADGE_REFRESH, {
    periodInMinutes: ALARM_INTERVALS.BADGE_REFRESH_MINUTES,
  })
  chrome.alarms.create(ALARM_NAMES.FOLLOWUP_CHECK, {
    periodInMinutes: ALARM_INTERVALS.FOLLOWUP_CHECK_MINUTES,
  })
  chrome.alarms.create(ALARM_NAMES.RETRY_CHECK, {
    periodInMinutes: ALARM_INTERVALS.RETRY_CHECK_MINUTES,
  })

  void updateBadge()
})

chrome.runtime.onStartup.addListener(() => {
  void updateBadge()
})
