"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Calendar, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Application {
  name: string
  company: string
  position: string
  stage: string
  deadline?: string
  followup_date?: string
  created_at?: string
  created?: string
}

type StageVariant = "applied" | "interview" | "offer" | "rejected" | "ghosted"

const STAGE_VARIANT: Record<string, StageVariant> = {
  applied: "applied",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
  ghosted: "ghosted",
}


const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function todayKey(): string {
  return toDateKey(new Date())
}

/**
 * Build a 6x7 grid of Date objects for the given month.
 * Week starts on Monday (ISO).
 */
function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  // getDay() returns 0=Sun..6=Sat; convert to 0=Mon..6=Sun
  const rawDow = firstDay.getDay()
  const startOffset = rawDow === 0 ? 6 : rawDow - 1

  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  const cells: (Date | null)[] = []

  // Leading empty cells
  for (let i = 0; i < startOffset; i++) {
    cells.push(null)
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d))
  }

  // Trailing empty cells to fill 6 rows (42 slots)
  while (cells.length < 42) {
    cells.push(null)
  }

  return cells
}

function isPast(dateKey: string, today: string): boolean {
  return dateKey < today
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DayPopoverProps {
  apps: Application[]
  onClose: () => void
  dateLabel: string
}

function DayPopover({ apps, onClose, dateLabel }: DayPopoverProps) {
  const router = useRouter()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Close"
          >
            x
          </button>
        </div>
        <ul className="p-3 space-y-2">
          {apps.map((app) => (
            <li key={app.name}>
              <button
                type="button"
                className="w-full text-left rounded-lg border border-border bg-background hover:bg-accent transition-colors p-3 group"
                onClick={() => {
                  onClose()
                  router.push(`/applications/${app.name}`)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {app.company}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {app.position}
                    </p>
                  </div>
                  <Badge
                    variant={STAGE_VARIANT[app.stage] ?? "default"}
                    className="capitalize shrink-0 text-xs"
                  >
                    {app.stage}
                  </Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface CalendarCellProps {
  date: Date | null
  apps: Application[]
  today: string
  onDayClick: (apps: Application[], dateLabel: string) => void
}

function CalendarCell({ date, apps, today, onDayClick }: CalendarCellProps) {
  if (date === null) {
    return (
      <div className="min-h-[90px] bg-muted/20 border-r border-b border-border last:border-r-0" />
    )
  }

  const key = toDateKey(date)
  const isToday = key === today
  const past = isPast(key, today)
  const hasApps = apps.length > 0
  const visible = apps.slice(0, 2)
  const overflow = apps.length - 2

  return (
    <div
      className={cn(
        "min-h-[90px] border-r border-b border-border last:border-r-0 p-1.5 flex flex-col gap-1 transition-colors",
        past && !isToday && "bg-muted/10",
        hasApps && "cursor-pointer hover:bg-accent/50",
        isToday && "bg-blue-50/60 dark:bg-blue-950/30"
      )}
      onClick={() => {
        if (hasApps) {
          const label = date.toLocaleDateString("en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
          onDayClick(apps, label)
        }
      }}
    >
      {/* Day number */}
      <div className="flex items-center justify-end">
        <span
          className={cn(
            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
            isToday
              ? "bg-blue-600 text-white font-bold"
              : past
              ? "text-muted-foreground"
              : "text-foreground"
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {/* App chips */}
      <div className="flex flex-col gap-0.5">
        {visible.map((app) => (
          <div
            key={app.name}
            className={cn(
              "text-[10px] leading-tight px-1.5 py-0.5 rounded font-medium truncate",
              app.stage === "applied" &&
                "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
              app.stage === "interview" &&
                "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
              app.stage === "offer" &&
                "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
              app.stage === "rejected" &&
                "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
              app.stage === "ghosted" &&
                "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
              !Object.keys(STAGE_VARIANT).includes(app.stage) &&
                "bg-muted text-muted-foreground"
            )}
          >
            {app.company}
          </div>
        ))}
        {overflow > 0 && (
          <div className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
            +{overflow} more
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile list view
// ---------------------------------------------------------------------------

interface MobileListViewProps {
  applications: Application[]
}

function MobileListView({ applications }: MobileListViewProps) {
  const router = useRouter()

  const withDeadline = useMemo(
    () =>
      applications
        .filter((a) => a.deadline)
        .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [applications]
  )

  const withoutDeadline = useMemo(
    () => applications.filter((a) => !a.deadline),
    [applications]
  )

  // Group by month (YYYY-MM)
  const grouped = useMemo(() => {
    const map = new Map<string, Application[]>()
    for (const app of withDeadline) {
      const monthKey = app.deadline!.slice(0, 7)
      const existing = map.get(monthKey) ?? []
      existing.push(app)
      map.set(monthKey, existing)
    }
    return map
  }, [withDeadline])

  const months = Array.from(grouped.keys()).sort()

  if (applications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No applications found.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {months.map((monthKey) => {
        const [y, m] = monthKey.split("-").map(Number)
        const label = `${MONTH_NAMES[m - 1]} ${y}`
        const apps = grouped.get(monthKey)!
        return (
          <div key={monthKey}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {label}
            </p>
            <div className="space-y-2">
              {apps.map((app) => (
                <button
                  key={app.name}
                  type="button"
                  className="w-full text-left"
                  onClick={() => router.push(`/applications/${app.name}`)}
                >
                  <Card className="hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {app.company}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {app.position}
                        </p>
                        {app.deadline && (
                          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                            Deadline: {app.deadline}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={STAGE_VARIANT[app.stage] ?? "default"}
                        className="capitalize shrink-0 text-xs"
                      >
                        {app.stage}
                      </Badge>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {withoutDeadline.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            No deadline
          </p>
          <div className="space-y-2">
            {withoutDeadline.map((app) => (
              <button
                key={app.name}
                type="button"
                className="w-full text-left"
                onClick={() => router.push(`/applications/${app.name}`)}
              >
                <Card className="hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {app.company}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {app.position}
                      </p>
                    </div>
                    <Badge
                      variant={STAGE_VARIANT[app.stage] ?? "default"}
                      className="capitalize shrink-0 text-xs"
                    >
                      {app.stage}
                    </Badge>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar grid skeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      {/* 6 rows x 7 cols */}
      {Array.from({ length: 6 }).map((_, row) => (
        <div key={row} className="grid grid-cols-7">
          {Array.from({ length: 7 }).map((_, col) => (
            <div
              key={col}
              className="min-h-[90px] border-r border-b border-border last:border-r-0 p-1.5"
            >
              <div className="flex justify-end">
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              {col % 3 === 0 && row < 4 && (
                <Skeleton className="h-4 w-full mt-1 rounded" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function StageLegend() {
  const entries: { variant: StageVariant; label: string }[] = [
    { variant: "applied", label: "Applied" },
    { variant: "interview", label: "Interview" },
    { variant: "offer", label: "Offer" },
    { variant: "rejected", label: "Rejected" },
    { variant: "ghosted", label: "Ghosted" },
  ]

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-muted-foreground font-medium">Legend:</span>
      {entries.map(({ variant, label }) => (
        <Badge key={variant} variant={variant} className="text-xs capitalize">
          {label}
        </Badge>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const now = new Date()
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [popover, setPopover] = useState<{
    apps: Application[]
    dateLabel: string
  } | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const today = todayKey()

  const { data, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications/list")
      if (!res.ok) throw new Error("Failed to load applications")
      return res.json() as Promise<{ applications: Application[] }>
    },
  })

  const applications: Application[] = data?.applications ?? []

  // Map: YYYY-MM-DD -> Application[]
  const appsByDate = useMemo(() => {
    const map = new Map<string, Application[]>()
    for (const app of applications) {
      const key = app.deadline ?? app.followup_date
      if (!key) continue
      const normalized = key.slice(0, 10)
      const existing = map.get(normalized) ?? []
      existing.push(app)
      map.set(normalized, existing)
    }
    return map
  }, [applications])

  const calendarCells = useMemo(
    () => buildCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  )

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const goToToday = () => {
    const n = new Date()
    setCurrentYear(n.getFullYear())
    setCurrentMonth(n.getMonth())
  }

  const handleExportIcal = async () => {
    setExportLoading(true)
    try {
      const res = await fetch("/api/export/ical")
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "cv-deadlines.ics"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("iCal export error:", err)
    } finally {
      setExportLoading(false)
    }
  }

  const handleDayClick = (apps: Application[], dateLabel: string) => {
    setPopover({ apps, dateLabel })
  }

  const closePopover = () => setPopover(null)

  const monthLabel = `${MONTH_NAMES[currentMonth]} ${currentYear}`

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Applications by deadline date
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportIcal}
          disabled={exportLoading}
          className="gap-1.5"
        >
          <Download className="w-4 h-4" />
          {exportLoading ? "Exporting..." : "Export .ics"}
        </Button>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevMonth}
            aria-label="Previous month"
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            aria-label="Next month"
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="ml-1 text-xs"
          >
            Today
          </Button>
        </div>

        <h2 className="text-lg font-semibold text-foreground tabular-nums">
          {monthLabel}
        </h2>
      </div>

      {/* Desktop calendar grid */}
      <div className="hidden md:block">
        {isLoading ? (
          <CalendarSkeleton />
        ) : (
          <Card className="overflow-hidden p-0">
            {/* Weekday header row */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/40">
              {WEEKDAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r border-border last:border-r-0"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar rows (6 x 7) */}
            {Array.from({ length: 6 }).map((_, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-7">
                {calendarCells
                  .slice(rowIdx * 7, rowIdx * 7 + 7)
                  .map((cell, colIdx) => {
                    const key = cell ? toDateKey(cell) : null
                    const apps = key ? (appsByDate.get(key) ?? []) : []
                    return (
                      <CalendarCell
                        key={colIdx}
                        date={cell}
                        apps={apps}
                        today={today}
                        onDayClick={handleDayClick}
                      />
                    )
                  })}
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Mobile list view */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <MobileListView applications={applications} />
        )}
      </div>

      {/* Legend */}
      <StageLegend />

      {/* Day popover */}
      {popover !== null && (
        <DayPopover
          apps={popover.apps}
          dateLabel={popover.dateLabel}
          onClose={closePopover}
        />
      )}
    </div>
  )
}
