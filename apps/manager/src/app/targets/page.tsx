"use client"

import Link from "next/link"
import { Terminal, ChevronRight } from "lucide-react"
import { useTargets } from "@/lib/api-hooks"
import type { Target } from "@/lib/api-types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByCategory(targets: Target[]): Map<string, Target[]> {
  return targets.reduce((acc, target) => {
    const cat = target.category || "Other"
    const list = acc.get(cat) ?? []
    list.push(target)
    acc.set(cat, list)
    return acc
  }, new Map<string, Target[]>())
}

const KNOWN_ACTION_PAGES = new Set([
  "apply",
  "fetch",
  "tailor",
  "score",
  "ats-rank",
  "diff",
  "compare",
  "archive",
  "archive-app",
  "render",
  "docx",
  "export",
  "export-csv",
  "cv-health",
  "culture",
  "contacts",
  "competitor-map",
  "glassdoor",
  "ai-cover-letter",
  "skills",
  "trends",
  "prep",
  "ai-interview-prep",
  "star",
  "milestone",
  "questions",
  "quiz",
  "salary",
  "negotiate",
  "thankyou",
  "email-sequence",
  "recruiter",
  "cold-sequence",
  "linkedin-message",
  "linkedin",
  "brand",
  "blog",
  "tasks",
  "quarterly",
  "discover",
  "digest",
  "apply-board",
  "cover-angles",
  "job-fit",
  "interview-brief",
  "prep-star",
  "interview-debrief",
  "salary-bench",
  "linkedin-post",
  "linkedin-profile",
  "recruiter-email",
  "followup",
])

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TargetRow({ target }: { target: Target }) {
  const hasPage = KNOWN_ACTION_PAGES.has(target.name)

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">
            {target.name}
          </code>
          {target.args && target.args.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {target.args.map((arg) => (
                <Badge key={arg} variant="outline" className="text-xs font-mono py-0 h-5">
                  {arg}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {target.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            {target.description}
          </p>
        )}
      </div>
      {hasPage && (
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link href={`/actions/${target.name}`}>
            Run
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      )}
    </div>
  )
}

function CategoryCard({ category, targets }: { category: string; targets: Target[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{category}</CardTitle>
        <CardDescription>
          {targets.length} target{targets.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div>
          {targets.map((t) => (
            <TargetRow key={t.name} target={t} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <Skeleton className="h-8 w-14 ml-4" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TargetsPage() {
  const { data: targets, isLoading, error } = useTargets()

  const grouped = targets ? groupByCategory(targets) : new Map<string, Target[]>()
  const sortedCategories = Array.from(grouped.keys()).sort()

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
          <Terminal className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Available Actions
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            All Make targets exposed by cv-api, grouped by category
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load targets</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <LoadingSkeleton />}

      {!isLoading && !error && targets && targets.length === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <Terminal className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No targets found</p>
          <p className="text-sm mt-1">cv-api returned an empty target list.</p>
        </div>
      )}

      {!isLoading && targets && targets.length > 0 && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {targets.length} total targets across {sortedCategories.length} categories
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedCategories.map((category) => (
              <CategoryCard
                key={category}
                category={category}
                targets={grouped.get(category) ?? []}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
