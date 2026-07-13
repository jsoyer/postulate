"use client"

import { cn } from "@/lib/utils"

export function TagCells({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">—</span>
  }
  const visible = tags.slice(0, 3)
  const overflow = tags.length - 3
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-1.5 py-0 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center px-1.5 py-0 rounded-full bg-slate-200 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400">
          +{overflow}
        </span>
      )}
    </div>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums min-w-[2.5rem]",
        score >= 70
          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
          : score >= 50
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
          : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
      )}
    >
      {score}
    </span>
  )
}
