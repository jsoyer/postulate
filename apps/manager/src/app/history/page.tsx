"use client"

import { useState } from "react"
import { Clock, Trash2, ChevronDown, ChevronRight, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useActionHistory, useClearActionHistory } from "@/lib/api-hooks"

interface HistoryEntry {
  action: string
  params: Record<string, string>
  lines: string[]
  timestamp: number
  success: boolean
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ParamsSummary({ params }: { params: Record<string, string> }) {
  const entries = Object.entries(params).filter(([, v]) => v)
  if (entries.length === 0) return null
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
      {entries.map(([k, v]) => `${k.toUpperCase()}=${v}`).join(" ")}
    </span>
  )
}

export default function HistoryPage() {
  const { data, isLoading } = useActionHistory()
  const clearActionHistory = useClearActionHistory()
  const [expanded, setExpanded] = useState<number | null>(null)

  const history: HistoryEntry[] = data?.entries ?? []

  const handleClear = async () => {
    await clearActionHistory.mutateAsync()
    setExpanded(null)
  }

  const toggleExpand = (i: number) => {
    setExpanded(prev => (prev === i ? null : i))
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Action History</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {isLoading ? (
              "Loading..."
            ) : history.length > 0 ? (
              `${history.length} recorded action${history.length !== 1 ? "s" : ""}`
            ) : (
              "No actions recorded yet"
            )}
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleClear} disabled={clearActionHistory.isPending}>
            <Trash2 className="w-4 h-4" />
            Clear history
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <p className="font-medium text-slate-700 dark:text-slate-300">Loading...</p>
          </CardContent>
        </Card>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <p className="font-medium text-slate-700 dark:text-slate-300">No actions yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              History is saved locally in your browser.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {history.map((entry, i) => (
            <Card key={i} className="overflow-hidden">
              <button
                onClick={() => toggleExpand(i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <Badge
                  variant={entry.success ? "outline" : "destructive"}
                  className={cn(
                    "shrink-0 text-xs",
                    entry.success && "text-green-600 border-green-200 dark:border-green-800 dark:text-green-400"
                  )}
                >
                  {entry.success ? "OK" : "Fail"}
                </Badge>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                      make {entry.action}
                    </span>
                    <ParamsSummary params={entry.params} />
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-xs text-slate-400"
                    title={formatTimestamp(entry.timestamp)}
                  >
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                  {expanded === i ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {expanded === i && entry.lines.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-950 border-b border-slate-700">
                    <Terminal className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500 font-mono">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <ScrollArea className="h-56 bg-slate-900 dark:bg-slate-950">
                    <div className="p-4 space-y-0.5 font-mono text-xs">
                      {entry.lines.map((line, j) => (
                        <div
                          key={j}
                          className={cn(
                            line.startsWith("[stderr]") && "text-amber-400",
                            line.startsWith("[error]") && "text-red-400",
                            !line.startsWith("[stderr]") && !line.startsWith("[error]") && "text-green-400"
                          )}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {expanded === i && entry.lines.length === 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">No output captured</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
