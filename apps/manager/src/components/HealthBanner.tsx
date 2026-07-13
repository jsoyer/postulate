"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, X } from "lucide-react"

type HealthData = { status: string }

export function HealthBanner() {
  const [dismissed, setDismissed] = useState(false)

  const { data, isError } = useQuery<HealthData>({
    queryKey: ["health"],
    queryFn: () => fetch("/api/health").then(r => r.json()),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const isDown = isError || (data !== undefined && data?.status !== "ok")

  // Re-show banner when status transitions to a non-ok state after being dismissed
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (isDown) {
      setDismissed(false)
    }
  }, [isDown])

  if (!isDown || dismissed) {
    return null
  }

  const isDegraded = !isError && data?.status === "degraded"
  const colorClasses = isDegraded
    ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-2 text-sm ${colorClasses}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          cv-api is unreachable — some features may not work.{" "}
          <Link href="/setup" className="underline underline-offset-2 hover:opacity-80">
            Run setup wizard
          </Link>{" "}
          or check your CV_API_URL configuration.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-current"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
