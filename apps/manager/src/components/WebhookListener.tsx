"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"
import { queryKeys } from "@/lib/api-hooks"
import type { Application } from "@/lib/api-types"

// ---------------------------------------------------------------------------
// Webhook event shape (mirrors the server-side schema in /api/webhook/route.ts)
// ---------------------------------------------------------------------------

interface WebhookEvent {
  event: string
  name: string | null
  timestamp: string
}

// ---------------------------------------------------------------------------
// Deadline reminder helpers
// ---------------------------------------------------------------------------

const DEADLINE_NOTIFIED_KEY = "deadline-notified"
const REMINDER_WINDOW_DAYS = 3

/** Returns today's date string as YYYY-MM-DD in local time. */
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Read the persisted map of { [appName]: lastNotifiedDate } from localStorage.
 * Returns an empty object when localStorage is unavailable or the value is corrupt.
 */
function readNotifiedMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEADLINE_NOTIFIED_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function writeNotifiedMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(DEADLINE_NOTIFIED_KEY, JSON.stringify(map))
  } catch {
    // localStorage may be unavailable (private mode, storage quota, etc.)
  }
}

/**
 * Given a list of applications, fire `toast.warning` for any application
 * whose deadline falls within the next REMINDER_WINDOW_DAYS days.
 * Each application is notified at most once per calendar day.
 */
function checkDeadlines(applications: Application[]): void {
  const today = todayKey()
  const now = Date.now()
  const notifiedMap = readNotifiedMap()
  let mapDirty = false

  for (const app of applications) {
    if (!app.deadline) continue

    const deadlineMs = new Date(app.deadline).getTime()
    if (isNaN(deadlineMs)) continue

    const daysLeft = Math.ceil((deadlineMs - now) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0 || daysLeft > REMINDER_WINDOW_DAYS) continue

    // Skip if already notified today for this application
    if (notifiedMap[app.name] === today) continue

    const label = daysLeft === 0 ? "today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`
    const company = app.company || app.name

    toast.warning(`Deadline approaching: ${company} — ${label}`, {
      duration: 10_000,
    })

    notifiedMap[app.name] = today
    mapDirty = true
  }

  if (mapDirty) writeNotifiedMap(notifiedMap)
}

// ---------------------------------------------------------------------------
// Toast message builder
// ---------------------------------------------------------------------------

/**
 * Map a raw event string (e.g. "cv.generated") to a human-readable message.
 * Falls back to the raw event string when unrecognised.
 */
function buildToastMessage(event: string, name: string | null): string {
  const appLabel = name ? ` — ${name}` : ""

  const eventMessages: Record<string, string> = {
    "cv.generated": `CV generated${appLabel}`,
    "cv.tailored": `CV tailored${appLabel}`,
    "application.created": `Application created${appLabel}`,
    "application.updated": `Application updated${appLabel}`,
    "application.deleted": `Application deleted${appLabel}`,
    "application.submitted": `Application submitted${appLabel}`,
    "stage.changed": `Stage changed${appLabel}`,
    "prep.generated": `Interview prep generated${appLabel}`,
    "cover.letter.generated": `Cover letter generated${appLabel}`,
    "email.drafted": `Email drafted${appLabel}`,
    "action.completed": `Action completed${appLabel}`,
    "action.failed": `Action failed${appLabel}`,
  }

  return eventMessages[event] ?? `${event}${appLabel}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WebhookListener() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const es = new EventSource("/api/webhook/events")

    es.onmessage = (ev: MessageEvent<string>) => {
      // Parse the event payload; fall back to a broad invalidation on parse failure
      let webhookEvent: WebhookEvent | null = null
      try {
        webhookEvent = JSON.parse(ev.data) as WebhookEvent
      } catch {
        // Heartbeat comments and malformed data — ignore silently
      }

      if (!webhookEvent) {
        // Generic refresh fallback (e.g. unrecognised SSE comment frames)
        void queryClient.invalidateQueries()
        return
      }

      const { event, name } = webhookEvent

      // Show a descriptive toast for every structured event
      const isFailure =
        event.endsWith(".failed") || event.endsWith(".error")

      const message = buildToastMessage(event, name)

      if (isFailure) {
        toast.error(message)
      } else {
        toast.success(message)
      }

      // Invalidate the relevant caches based on event semantics
      if (name && (event.startsWith("application.") || event.startsWith("stage.") || event.startsWith("cv."))) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.application(name) })
        void queryClient.invalidateQueries({ queryKey: ["applications"] })
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })
      } else {
        // Broad invalidation for unknown or non-application-specific events
        void queryClient.invalidateQueries()
      }

      // After updating application data, check for upcoming deadlines.
      // We read from the cache that was just invalidated and will refetch shortly;
      // use the stale snapshot for the deadline check — it is accurate enough.
      if (event.startsWith("application.") || event.startsWith("stage.")) {
        const cachedList = queryClient.getQueryData<Application[]>(queryKeys.applications())
        if (cachedList) {
          checkDeadlines(cachedList)
        }
      }
    }

    es.onerror = () => {
      // EventSource reconnects automatically; we do nothing here.
    }

    return () => es.close()
  }, [queryClient])

  return null
}

// ---------------------------------------------------------------------------
// Standalone deadline checker — call this after any applications list fetch
// ---------------------------------------------------------------------------

/**
 * Exported so that other components (e.g. a dashboard page) can trigger
 * deadline checks immediately after fetching the applications list, without
 * waiting for a webhook event.
 */
export { checkDeadlines }
