"use client"

import Link from "next/link"
import { CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getActionBySlug } from "@/lib/action-registry"
import type { ActionHistoryEntry } from "@/lib/api-types"

interface RecentActionsProps {
  appName: string
}

export function RecentActions({ appName }: RecentActionsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["action-history", appName],
    queryFn: async () => {
      const res = await fetch("/api/action-history")
      if (!res.ok) throw new Error("Failed to fetch action history")
      return res.json() as Promise<{ entries: ActionHistoryEntry[]; total: number }>
    },
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const appEntries = (data?.entries ?? [])
    .filter(entry => entry.params?.name === appName)
    .slice(0, 5)

  if (appEntries.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Recent Actions
        </h3>
        <div className="text-center py-8 text-muted-foreground border border-border rounded-lg">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No actions run yet for this application.</p>
          <p className="text-xs mt-1">Run an action above to see it here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
        Recent Actions
      </h3>
      <div className="space-y-2">
        {appEntries.map((entry, idx) => {
          const action = getActionBySlug(entry.action)
          const title = action?.title ?? entry.action
          const timestamp = new Date(entry.timestamp).toLocaleString()

          return (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-background border border-border rounded-lg gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {entry.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <p className="text-xs text-muted-foreground">{timestamp}</p>
                </div>
              </div>
              <Link href={`/actions/${entry.action}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Run Again
                </Button>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
