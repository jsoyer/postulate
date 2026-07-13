"use client"

import { cn } from "@/lib/utils"

export interface TimelineEvent {
  date: string
  title: string
  description?: string
  type: "stage" | "note" | "action" | "milestone"
}

interface TimelineViewProps {
  events: TimelineEvent[]
  emptyMessage?: string
}

const TYPE_DOT_CLASSES: Record<TimelineEvent["type"], string> = {
  stage:     "bg-blue-500 dark:bg-blue-400",
  note:      "bg-slate-400 dark:bg-slate-500",
  action:    "bg-purple-500 dark:bg-purple-400",
  milestone: "bg-green-500 dark:bg-green-400",
}

function formatEventDate(raw: string): string {
  const date = new Date(raw)
  if (isNaN(date.getTime())) return raw

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    // Future date — show absolute
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays <= 7) return `${diffDays} days ago`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function TimelineView({
  events,
  emptyMessage = "No events yet.",
}: TimelineViewProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">{emptyMessage}</p>
    )
  }

  return (
    <ol className="relative pl-6">
      {/* Vertical line */}
      <div
        className="absolute left-2 top-2 bottom-2 w-px bg-border"
        aria-hidden="true"
      />

      {events.map((event, index) => (
        <li key={index} className="relative mb-6 last:mb-0">
          {/* Dot */}
          <span
            className={cn(
              "absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background shadow-sm",
              TYPE_DOT_CLASSES[event.type]
            )}
            aria-hidden="true"
          />

          <div className="min-w-0">
            {/* Date */}
            <time
              dateTime={event.date}
              className="block text-xs text-muted-foreground font-mono mb-0.5"
            >
              {formatEventDate(event.date)}
            </time>

            {/* Title */}
            <p className="text-sm font-semibold leading-snug text-foreground">
              {event.title}
            </p>

            {/* Optional description */}
            {event.description && (
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                {event.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
