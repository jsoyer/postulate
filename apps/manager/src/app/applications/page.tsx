"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Plus, FileText, Columns } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { FilterBar } from "@/components/applications/FilterBar"
import { BatchActionBar } from "@/components/applications/BatchActionBar"
import { TagEditorDialog } from "@/components/applications/TagEditorDialog"
import { ApplicationTable } from "@/components/applications/ApplicationTable"
import { ApplicationCard } from "@/components/applications/ApplicationCard"

interface Application {
  name: string
  company: string
  position: string
  created: string
  stage: string
  deadline?: string
  files: string[]
}

function TableSkeleton() {
  return (
    <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900">
            <th className="w-10 p-2" />
            <th className="p-2">Company</th>
            <th className="p-2">Position</th>
            <th className="p-2">Stage</th>
            <th className="p-2">Tags</th>
            <th className="p-2">Score</th>
            <th className="p-2">Match</th>
            <th className="p-2">Created</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="p-2"><Skeleton className="h-4 w-4 rounded" /></td>
              <td className="p-2">
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-20" />
              </td>
              <td className="p-2"><Skeleton className="h-4 w-40" /></td>
              <td className="p-2"><Skeleton className="h-5 w-16 rounded-full" /></td>
              <td className="p-2"><Skeleton className="h-5 w-24 rounded-full" /></td>
              <td className="p-2"><Skeleton className="h-5 w-8 rounded-full" /></td>
              <td className="p-2"><Skeleton className="h-5 w-8 rounded-full" /></td>
              <td className="p-2"><Skeleton className="h-4 w-20" /></td>
              <td className="p-2" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ApplicationsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [sort, setSort] = useState("newest")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchRunning, setBatchRunning] = useState(false)
  const [updatingStage, setUpdatingStage] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ name: string; field: "company" | "position" } | null>(null)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  const [dateFrom, setDateFrom] = useState("")
  const [minScore, setMinScore] = useState<number | null>(null)
  const [tagFilter, setTagFilter] = useState("")

  const [tagEditorApp, setTagEditorApp] = useState<string | null>(null)

  const [appTags, setAppTags] = useState<Record<string, string[]>>({})
  const [atsScores, setAtsScores] = useState<Record<string, number | undefined>>({})
  const [jobMatchScores, setJobMatchScores] = useState<Record<string, number | undefined>>({})

  const { data, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications/list")
      return res.json()
    },
  })

  useEffect(() => {
    const apps = data?.applications ?? []
    if (apps.length === 0) return
    Promise.all(
      apps.map(async (app: { name: string }) => {
        try {
          const res = await fetch(`/api/applications/${encodeURIComponent(app.name)}/tags`)
          const d = await res.json()
          return { name: app.name, tags: d.tags ?? [] }
        } catch {
          return { name: app.name, tags: [] }
        }
      })
    ).then(results => {
      const map: Record<string, string[]> = {}
      results.forEach(r => { map[r.name] = r.tags })
      setAppTags(map)
    })
  }, [data])

  useEffect(() => {
    const apps = data?.applications ?? []
    if (apps.length === 0) return
    Promise.all(
      apps.map(async (app: { name: string }) => {
        try {
          const res = await fetch(`/api/applications/${encodeURIComponent(app.name)}/ats-scores`)
          const d = await res.json()
          const history = d.history ?? []
          const latest = history.length > 0 ? history[history.length - 1].score : undefined
          return { name: app.name, score: latest }
        } catch {
          return { name: app.name, score: undefined }
        }
      })
    ).then(results => {
      const map: Record<string, number | undefined> = {}
      results.forEach(r => { map[r.name] = r.score })
      setAtsScores(map)
    })
  }, [data])

  useEffect(() => {
    const apps = data?.applications ?? []
    if (apps.length === 0) return
    Promise.all(
      apps.map(async (app: { name: string }) => {
        try {
          const res = await fetch(`/api/applications/${encodeURIComponent(app.name)}/match`)
          const d = await res.json()
          const score = d?.overall_score ?? undefined
          return { name: app.name, score }
        } catch {
          return { name: app.name, score: undefined }
        }
      })
    ).then(results => {
      const map: Record<string, number | undefined> = {}
      results.forEach(r => { map[r.name] = r.score })
      setJobMatchScores(map)
    })
  }, [data])

  const deadlineThreshold = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    []
  )

  const applications: Application[] = useMemo(() => {
    let apps: Application[] = data?.applications || []

    if (search) {
      const q = search.toLowerCase()
      apps = apps.filter(
        (a) => a.company.toLowerCase().includes(q) || a.position.toLowerCase().includes(q)
      )
    }
    if (stageFilter && stageFilter !== "all") {
      apps = apps.filter((a) => a.stage === stageFilter)
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      apps = apps.filter((a) => {
        const created = new Date(a.created).getTime()
        return !isNaN(created) && created >= from
      })
    }
    if (minScore !== null) {
      apps = apps.filter((a) => {
        const score = atsScores[a.name]
        return score !== undefined && score >= minScore
      })
    }
    if (tagFilter.trim()) {
      const needle = tagFilter.trim().toLowerCase()
      apps = apps.filter((a) => {
        const tags = appTags[a.name] ?? []
        return tags.some((t) => t.includes(needle))
      })
    }

    if (sort === "oldest") apps = [...apps].reverse()
    else if (sort === "az") apps = [...apps].sort((a, b) => a.company.localeCompare(b.company))
    return apps
  }, [data, search, stageFilter, sort, dateFrom, minScore, tagFilter, atsScores, appTags])

  const allSelected = applications.length > 0 && applications.every((a) => selected.has(a.name))
  const someSelected = selected.size > 0

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(applications.map((a) => a.name)))
  }

  const toggleOne = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const updateStage = async (name: string, stage: string) => {
    setUpdatingStage(name)
    try {
      const res = await fetch(`/api/applications/${name}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      })
      if (!res.ok) throw new Error("Failed")
      queryClient.invalidateQueries({ queryKey: ["applications"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    } catch {
      toast.error("Failed to update stage")
    } finally {
      setUpdatingStage(null)
    }
  }

  const batchUpdateStage = async (stage: string) => {
    setBatchRunning(true)
    const names = Array.from(selected)
    let succeeded = 0
    for (const name of names) {
      try {
        const res = await fetch(`/api/applications/${name}/stage`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
        })
        if (res.ok) succeeded++
      } catch {}
    }
    setBatchRunning(false)
    setSelected(new Set())
    queryClient.invalidateQueries({ queryKey: ["applications"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    toast.success(`Stage updated for ${succeeded}/${names.length} applications`)
  }

  const startEdit = (name: string, field: "company" | "position", value: string) => {
    setEditingCell({ name, field })
    setEditValue(value)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const cancelEdit = () => setEditingCell(null)

  const saveEdit = async () => {
    if (!editingCell) return
    const { name, field } = editingCell
    setEditingCell(null)
    try {
      const res = await fetch(`/api/applications/${name}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: editValue }),
      })
      if (!res.ok) throw new Error("Failed")
      queryClient.invalidateQueries({ queryKey: ["applications"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(`${field === "company" ? "Company" : "Position"} updated`)
    } catch {
      toast.error("Failed to save changes")
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === "Escape") cancelEdit()
  }

  const runBatchScore = async () => {
    setBatchRunning(true)
    const names = Array.from(selected)
    let succeeded = 0
    for (const name of names) {
      try {
        const res = await fetch("/api/actions/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "score", name }),
        })
        if (res.body) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let output = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            output += decoder.decode(value, { stream: true })
          }
          const match = output.match(/ATS.*?(\d+)/i)
          if (match) {
            const score = parseInt(match[1])
            try {
              await fetch(`/api/applications/${encodeURIComponent(name)}/ats-scores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: new Date().toISOString(), score }),
              })
              setAtsScores(prev => ({ ...prev, [name]: score }))
              succeeded++
            } catch {}
          }
        }
      } catch {}
    }
    setBatchRunning(false)
    setSelected(new Set())
    queryClient.invalidateQueries({ queryKey: ["applications"] })
    toast.success(`ATS scoring complete — ${succeeded}/${names.length} scored`)
  }

  const runBatchJobMatch = async () => {
    setBatchRunning(true)
    const names = Array.from(selected)
    let succeeded = 0
    for (const name of names) {
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(name)}/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        if (res.ok) {
          const d = await res.json()
          setJobMatchScores(prev => ({ ...prev, [name]: d.overall_score }))
          succeeded++
        }
      } catch {}
    }
    setBatchRunning(false)
    setSelected(new Set())
    queryClient.invalidateQueries({ queryKey: ["applications"] })
    toast.success(`Job match complete — ${succeeded}/${names.length} analyzed`)
  }

  const clearAdvancedFilters = () => {
    setDateFrom("")
    setMinScore(null)
    setTagFilter("")
  }

  const totalCount = data?.applications?.length || 0

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-screen-xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Applications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32" />
            ) : (
              <>
                {applications.length === totalCount
                  ? `${totalCount} application${totalCount !== 1 ? "s" : ""}`
                  : `${applications.length} of ${totalCount} shown`}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
            <Link href="/applications/board">
              <Columns className="w-4 h-4 mr-1.5" />
              Board
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/applications/new">
              <Plus className="w-4 h-4 mr-1.5" />
              New
            </Link>
          </Button>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        sort={sort}
        onSortChange={setSort}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        onClearAdvanced={clearAdvancedFilters}
      />

      {someSelected && (
        <BatchActionBar
          selectedCount={selected.size}
          batchRunning={batchRunning}
          onBatchScore={runBatchScore}
          onBatchJobMatch={runBatchJobMatch}
          onBatchStageChange={batchUpdateStage}
          onClear={() => setSelected(new Set())}
        />
      )}

      {isLoading && <TableSkeleton />}

      {!isLoading && applications.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4 mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
              {search || (stageFilter && stageFilter !== "all") || dateFrom || minScore !== null || tagFilter.trim()
                ? "No applications match your filters"
                : "No applications yet"}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {search || (stageFilter && stageFilter !== "all") || dateFrom || minScore !== null || tagFilter.trim()
                ? "Try adjusting your search or filters."
                : "Create your first application to get started."}
            </p>
            {!search && (!stageFilter || stageFilter === "all") && !dateFrom && minScore === null && !tagFilter.trim() && (
              <Button asChild size="sm">
                <Link href="/applications/new">
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Application
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && applications.length > 0 && (
        <>
          <ApplicationTable
            applications={applications}
            selected={selected}
            atsScores={atsScores}
            jobMatchScores={jobMatchScores}
            appTags={appTags}
            deadlineThreshold={deadlineThreshold}
            editingCell={editingCell}
            editValue={editValue}
            editInputRef={editInputRef}
            updatingStage={updatingStage}
            onSelectAll={toggleAll}
            onSelectOne={toggleOne}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onEditKeyDown={handleEditKeyDown}
            onUpdateStage={updateStage}
            onEditTags={setTagEditorApp}
          />

          <div className="md:hidden space-y-2">
            {applications.map((app) => (
              <ApplicationCard
                key={app.name}
                app={app}
                score={atsScores[app.name]}
                tags={appTags[app.name] ?? []}
                deadlineThreshold={deadlineThreshold}
                onEditTags={setTagEditorApp}
              />
            ))}
          </div>
        </>
      )}

      {tagEditorApp !== null && (
        <TagEditorDialog
          appName={tagEditorApp}
          open={tagEditorApp !== null}
          onClose={() => setTagEditorApp(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
