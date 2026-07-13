"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Application {
  name: string
  company: string
  position: string
  stage: string
  created: string
}

const STAGES = [
  {
    key: "applied",
    label: "Applied",
    headerBg: "bg-blue-50 dark:bg-blue-950/40",
    headerBorder: "border-blue-200 dark:border-blue-800",
    colBg: "bg-blue-50/40 dark:bg-blue-950/20",
    colBorder: "border-blue-200 dark:border-blue-800",
    cardAccent: "border-l-blue-400 dark:border-l-blue-500",
    dropRing: "ring-blue-400",
    badgeVariant: "applied" as const,
  },
  {
    key: "interview",
    label: "Interview",
    headerBg: "bg-amber-50 dark:bg-amber-950/40",
    headerBorder: "border-amber-200 dark:border-amber-800",
    colBg: "bg-amber-50/40 dark:bg-amber-950/20",
    colBorder: "border-amber-200 dark:border-amber-800",
    cardAccent: "border-l-amber-400 dark:border-l-amber-500",
    dropRing: "ring-amber-400",
    badgeVariant: "interview" as const,
  },
  {
    key: "offer",
    label: "Offer",
    headerBg: "bg-green-50 dark:bg-green-950/40",
    headerBorder: "border-green-200 dark:border-green-800",
    colBg: "bg-green-50/40 dark:bg-green-950/20",
    colBorder: "border-green-200 dark:border-green-800",
    cardAccent: "border-l-green-400 dark:border-l-green-500",
    dropRing: "ring-green-400",
    badgeVariant: "offer" as const,
  },
  {
    key: "rejected",
    label: "Rejected",
    headerBg: "bg-red-50 dark:bg-red-950/40",
    headerBorder: "border-red-200 dark:border-red-800",
    colBg: "bg-red-50/40 dark:bg-red-950/20",
    colBorder: "border-red-200 dark:border-red-800",
    cardAccent: "border-l-red-400 dark:border-l-red-500",
    dropRing: "ring-red-400",
    badgeVariant: "rejected" as const,
  },
  {
    key: "ghosted",
    label: "Ghosted",
    headerBg: "bg-slate-50 dark:bg-slate-800/60",
    headerBorder: "border-slate-200 dark:border-slate-700",
    colBg: "bg-slate-50/40 dark:bg-slate-800/20",
    colBorder: "border-slate-200 dark:border-slate-700",
    cardAccent: "border-l-slate-400 dark:border-l-slate-500",
    dropRing: "ring-slate-400",
    badgeVariant: "ghosted" as const,
  },
]

function ColumnSkeleton() {
  return (
    <div className="flex-shrink-0 w-64 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
      </div>
      <div className="p-3 space-y-2 min-h-32 bg-slate-50/40 dark:bg-slate-800/20">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 border-l-4 border-l-slate-200 dark:border-l-slate-600">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-32 mb-1" />
            <Skeleton className="h-3 w-16 mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BoardPage() {
  const queryClient = useQueryClient()
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications/list")
      return res.json()
    },
  })

  const applications: Application[] = data?.applications || []

  const byStage = STAGES.reduce((acc, s) => {
    acc[s.key] = applications.filter((a) => a.stage === s.key)
    return acc
  }, {} as Record<string, Application[]>)

  const handleDrop = async (targetStage: string) => {
    if (!dragging) {
      setDragOverCol(null)
      return
    }
    const app = applications.find((a) => a.name === dragging)
    if (!app || app.stage === targetStage) {
      setDragging(null)
      setDragOverCol(null)
      return
    }
    const previousStage = app.stage
    setDragging(null)
    setDragOverCol(null)

    try {
      const res = await fetch(`/api/applications/${dragging}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: targetStage }),
      })
      if (!res.ok) throw new Error("Failed")
      queryClient.invalidateQueries({ queryKey: ["applications"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(`Moved to ${targetStage}`, {
        description: app.company,
      })
    } catch {
      toast.error("Failed to update stage", {
        description: `${app.company} remains in ${previousStage}`,
      })
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0" aria-label="Back to applications">
            <Link href="/applications">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Board
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Drag cards to update stage
            </p>
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href="/applications/new">
            <Plus className="w-4 h-4 mr-1.5" />
            New
          </Link>
        </Button>
      </div>

      {/* Board columns */}
      <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 md:-mx-8 md:px-8">
        {isLoading
          ? STAGES.map((s) => <ColumnSkeleton key={s.key} />)
          : STAGES.map((stage) => {
              const cards = byStage[stage.key] || []
              const isOver = dragOverCol === stage.key

              return (
                <div
                  key={stage.key}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverCol(stage.key)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverCol(null)
                    }
                  }}
                  onDrop={() => handleDrop(stage.key)}
                  className={cn(
                    "flex-shrink-0 w-64 rounded-xl border-2 overflow-hidden transition-all duration-150",
                    stage.colBorder,
                    isOver
                      ? cn("ring-2 ring-offset-2 dark:ring-offset-slate-950", stage.dropRing, "scale-[1.01]")
                      : ""
                  )}
                >
                  {/* Column header */}
                  <div
                    className={cn(
                      "px-3 py-3 border-b",
                      stage.headerBg,
                      stage.headerBorder
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={stage.badgeVariant} className="capitalize font-semibold">
                        {stage.label}
                      </Badge>
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums rounded-full px-2 py-0.5 bg-white/80 dark:bg-slate-900/60",
                          "text-slate-600 dark:text-slate-300 border border-white/60 dark:border-slate-700"
                        )}
                      >
                        {cards.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards area */}
                  <div
                    className={cn(
                      "p-2.5 space-y-2 min-h-32 transition-colors",
                      stage.colBg
                    )}
                  >
                    {cards.length === 0 ? (
                      <div
                        className={cn(
                          "rounded-lg border-2 border-dashed min-h-24 flex items-center justify-center",
                          isOver
                            ? cn(stage.colBorder, "opacity-100")
                            : "border-slate-200/80 dark:border-slate-700/60 opacity-60"
                        )}
                      >
                        <span className="text-xs text-slate-400 dark:text-slate-500 select-none">
                          Drop here
                        </span>
                      </div>
                    ) : (
                      cards.map((app) => (
                        <Card
                          key={app.name}
                          draggable
                          onDragStart={() => setDragging(app.name)}
                          onDragEnd={() => {
                            setDragging(null)
                            setDragOverCol(null)
                          }}
                          className={cn(
                            "border-l-4 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all duration-150 select-none",
                            stage.cardAccent,
                            dragging === app.name
                              ? "opacity-40 scale-95 rotate-1"
                              : "hover:-translate-y-0.5"
                          )}
                        >
                          <CardContent className="p-3">
                            <Link
                              href={`/applications/${app.name}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block"
                            >
                              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                                {app.company}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {app.position}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono">
                                {app.created}
                              </p>
                            </Link>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
      </div>
    </div>
  )
}
