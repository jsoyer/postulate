"use client"

import { AlertTriangle, Tag } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { TagCells, ScoreBadge } from "./ApplicationRow"

interface Application {
  name: string
  company: string
  position: string
  created: string
  stage: string
  deadline?: string
  files: string[]
}

const STAGE_VARIANT: Record<string, "applied" | "interview" | "offer" | "rejected" | "ghosted"> = {
  applied: "applied",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
  ghosted: "ghosted",
}

interface ApplicationCardProps {
  app: Application
  score: number | undefined
  tags: string[]
  deadlineThreshold: Date
  onEditTags: (name: string) => void
}

export function ApplicationCard({ app, score, tags, deadlineThreshold, onEditTags }: ApplicationCardProps) {
  const isDeadlineSoon = app.deadline && new Date(app.deadline) <= deadlineThreshold

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/applications/${app.name}`} className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {app.company}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {app.position}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-slate-400 font-mono">{app.created}</span>
              {isDeadlineSoon && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Due {app.deadline}
                </span>
              )}
            </div>
            {tags.length > 0 && (
              <div className="mt-2">
                <TagCells tags={tags} />
              </div>
            )}
          </Link>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant={STAGE_VARIANT[app.stage] ?? "secondary"} className="capitalize">
              {app.stage}
            </Badge>
            {score !== undefined && <ScoreBadge score={score} />}
            <button
              type="button"
              onClick={() => onEditTags(app.name)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Edit tags"
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
