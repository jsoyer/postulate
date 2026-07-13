"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ACTION_REGISTRY,
  getAllCategories,
  CATEGORY_LABELS,
  type ActionCategory,
  type ActionRegistryEntry,
} from "@/lib/action-registry"

interface RecentAction {
  action: string
  timestamp: number
}

const CATEGORY_ICONS: Record<ActionCategory, string> = {
  workflow: "⚡",
  cv: "📄",
  intelligence: "🔍",
  interview: "🎯",
  salary: "💰",
  outreach: "📧",
  linkedin: "🔗",
  reports: "📊",
}

function ActionCard({ action }: { action: ActionRegistryEntry }) {
  return (
    <Link
      href={`/actions/${action.slug}`}
      className="group block p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all bg-white dark:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
            {action.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {action.description}
          </p>
        </div>
        <span className="text-lg shrink-0" aria-hidden="true">
          {CATEGORY_ICONS[action.category]}
        </span>
      </div>
      {action.hasAI && (
        <Badge variant="secondary" className="mt-2 text-xs">
          AI
        </Badge>
      )}
    </Link>
  )
}

export default function ActionsGridPage() {
  const [search, setSearch] = useState("")
  const [recentActions, setRecentActions] = useState<RecentAction[]>([])

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem("cv-action-history") || "[]")
      const recent = history
        .filter((item: any) => item.action && item.timestamp)
        .map((item: any) => ({ action: item.action, timestamp: item.timestamp }))
        .slice(0, 8)
      setRecentActions(recent)
    } catch {
      setRecentActions([])
    }
  }, [])

  const filteredActions = ACTION_REGISTRY.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase()) ||
    a.slug.toLowerCase().includes(search.toLowerCase())
  )

  const categories = getAllCategories()

  const getRecentActionEntries = (): ActionRegistryEntry[] => {
    const seen = new Set<string>()
    return recentActions
      .map(r => ACTION_REGISTRY.find(a => a.slug === r.action))
      .filter((a): a is ActionRegistryEntry => {
        if (a == null || seen.has(a.slug)) return false
        seen.add(a.slug)
        return true
      })
  }

  const recentEntries = getRecentActionEntries()

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Actions</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Browse all available actions by category
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search actions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {/* Recently Used */}
      {recentEntries.length > 0 && !search && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recently Used
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentEntries.map(action => (
              <ActionCard key={action.slug} action={action} />
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.map(category => {
        const categoryActions = filteredActions.filter(a => a.category === category)
        if (categoryActions.length === 0) return null

        return (
          <section key={category} className="mb-10">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryActions.map(action => (
                <ActionCard key={action.slug} action={action} />
              ))}
            </div>
          </section>
        )
      })}

      {filteredActions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">
            No actions found matching &quot;{search}&quot;
          </p>
        </div>
      )}
    </div>
  )
}
