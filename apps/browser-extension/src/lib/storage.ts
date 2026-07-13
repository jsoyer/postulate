/**
 * Type-safe wrappers around chrome.storage.sync and chrome.storage.local.
 */

import { DEFAULT_API_URL, STORAGE_KEYS } from "./constants"
import type { Application, ExtensionSettings, PendingJob } from "./types"

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiUrl: DEFAULT_API_URL,
  apiKey: "",
  theme: "system",
  badgeEnabled: true,
  notificationsEnabled: true,
}

// ---------------------------------------------------------------------------
// Settings (stored in sync storage so they roam across devices)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, (result) => {
      const stored = result[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
      resolve({ ...DEFAULT_SETTINGS, ...stored })
    })
  })
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve()
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Recent applications (stored in local storage — larger quota)
// ---------------------------------------------------------------------------

export async function getRecentApplications(): Promise<Application[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.RECENT_APPLICATIONS, (result) => {
      const stored = result[STORAGE_KEYS.RECENT_APPLICATIONS] as Application[] | undefined
      resolve(stored ?? [])
    })
  })
}

export async function saveRecentApplications(apps: Application[]): Promise<void> {
  // Keep only the 20 most recent
  const trimmed = apps.slice(0, 20)
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RECENT_APPLICATIONS]: trimmed }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve()
      }
    })
  })
}

export async function prependApplication(app: Application): Promise<Application[]> {
  const existing = await getRecentApplications()
  // Deduplicate by name
  const filtered = existing.filter((a) => a.name !== app.name)
  const updated = [app, ...filtered]
  await saveRecentApplications(updated)
  return updated
}

// ---------------------------------------------------------------------------
// Pending jobs queue (jobs saved while offline)
// ---------------------------------------------------------------------------

export async function getPendingJobs(): Promise<PendingJob[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.PENDING_JOBS, (result) => {
      const stored = result[STORAGE_KEYS.PENDING_JOBS] as PendingJob[] | undefined
      resolve(stored ?? [])
    })
  })
}

export async function savePendingJobs(jobs: PendingJob[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.PENDING_JOBS]: jobs }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve()
      }
    })
  })
}

export async function addPendingJob(job: PendingJob): Promise<void> {
  const existing = await getPendingJobs()
  await savePendingJobs([...existing, job])
}

export async function removePendingJob(id: string): Promise<void> {
  const existing = await getPendingJobs()
  await savePendingJobs(existing.filter((j) => j.id !== id))
}

export async function updatePendingJob(
  id: string,
  updates: Partial<PendingJob>
): Promise<void> {
  const existing = await getPendingJobs()
  const updated = existing.map((j) => (j.id === id ? { ...j, ...updates } : j))
  await savePendingJobs(updated)
}
