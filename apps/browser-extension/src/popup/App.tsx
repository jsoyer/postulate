import { useEffect, useState } from "react"
import { browser } from "../lib/browser"
import { ApplicationList } from "./components/ApplicationList"
import { QuickActions } from "./components/QuickActions"
import { getRecentApplications, getSettings } from "../lib/storage"
import type { Application, ExtensionMessage, ExtensionSettings, PendingJob } from "../lib/types"

// ---------------------------------------------------------------------------
// Connection status indicator
// ---------------------------------------------------------------------------

function ConnectionDot({ healthy }: { healthy: boolean | null }) {
  if (healthy === null) {
    return (
      <span className="inline-block h-2 w-2 rounded-full bg-gray-500 animate-pulse" />
    )
  }
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        healthy ? "bg-green-400" : "bg-red-400"
      }`}
      title={healthy ? "Connected to cv-api" : "Cannot reach cv-api"}
    />
  )
}

// ---------------------------------------------------------------------------
// Pending jobs section
// ---------------------------------------------------------------------------

function PendingJobsSection({
  jobs,
  onRetry,
  isRetrying,
}: {
  jobs: PendingJob[]
  onRetry: () => void
  isRetrying: boolean
}) {
  if (jobs.length === 0) return null

  return (
    <div className="border-t border-white/10 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Pending Jobs ({jobs.length})
        </h2>
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isRetrying ? "Retrying..." : "Retry Now"}
        </button>
      </div>
      <ul className="space-y-1.5">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="rounded-lg bg-gray-800 px-3 py-2 text-xs"
          >
            <div className="font-medium text-gray-200">
              {job.job.position}
            </div>
            <div className="text-gray-400">{job.job.company}</div>
            {job.lastError && (
              <div className="mt-1 text-[10px] text-red-400">
                {job.lastError}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  function loadPendingJobs() {
    const msg: ExtensionMessage = { type: "GET_PENDING_JOBS" }
    chrome.runtime
      .sendMessage(msg)
      .then((res: { success: boolean; jobs?: PendingJob[] }) => {
        if (res.success && res.jobs) {
          setPendingJobs(res.jobs)
        }
      })
      .catch(() => {
        // Ignore
      })
  }

  useEffect(() => {
    // Load settings
    void getSettings().then(setSettings)

    // Load cached recent applications immediately for fast render
    void getRecentApplications().then((apps) => {
      setApplications(apps)
      setIsLoading(false)
    })

    // Check API health via background
    const healthMsg: ExtensionMessage = { type: "CHECK_HEALTH" }
    browser.runtime
      .sendMessage(healthMsg)
      .then((res: { healthy: boolean }) => setHealthy(res.healthy))
      .catch(() => setHealthy(false))

    // Fetch fresh applications from background
    const appsMsg: ExtensionMessage = { type: "GET_RECENT_APPLICATIONS" }
    browser.runtime
      .sendMessage(appsMsg)
      .then((res: { success: boolean; apps?: Application[] }) => {
        if (res.success && res.apps) {
          setApplications(res.apps)
        }
      })
      .catch(() => {
        // Use cached data — already set above
      })

    // Load pending jobs
    loadPendingJobs()
  }, [])

  function handleRetry() {
    setIsRetrying(true)
    const msg: ExtensionMessage = { type: "RETRY_PENDING_JOBS" }
    chrome.runtime
      .sendMessage(msg)
      .then((res: { success: boolean; jobs?: PendingJob[] }) => {
        if (res.success && res.jobs) {
          setPendingJobs(res.jobs)
        }
      })
      .catch(() => {
        // Ignore
      })
      .finally(() => {
        setTimeout(() => setIsRetrying(false), 1000)
      })
  }

  const apiUrl = settings?.apiUrl ?? ""

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-600">
            <svg
              className="h-3.5 w-3.5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span className="text-sm font-semibold">CV Pipeline</span>
        </div>

        <div className="flex items-center gap-1.5">
          <ConnectionDot healthy={healthy} />
          <span className="text-xs text-gray-400">
            {healthy === null ? "Checking..." : healthy ? "Connected" : "Offline"}
          </span>
        </div>
      </header>

      {/* Not configured warning */}
      {settings && !settings.apiKey && (
        <div className="mx-4 mt-3 rounded-lg bg-amber-900/40 border border-amber-700/50 px-3 py-2">
          <p className="text-xs text-amber-300">
            API key not configured.{" "}
            <button
              className="underline hover:text-amber-200"
              onClick={() => browser.runtime.openOptionsPage()}
            >
              Open settings
            </button>
          </p>
        </div>
      )}

      {/* Recent applications */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Recent Applications
        </h2>
        <ApplicationList
          applications={applications.slice(0, 5)}
          isLoading={isLoading}
        />
      </div>

      {/* Pending jobs */}
      <PendingJobsSection
        jobs={pendingJobs}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />

      {/* Quick actions */}
      <div className="border-t border-white/10 px-4 py-3">
        <QuickActions apiUrl={apiUrl} />
      </div>
    </div>
  )
}
