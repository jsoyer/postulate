"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Zap, Search, FileText, Users, Handshake, BarChart3,
  ChevronDown, ChevronRight, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  STAGE_GROUPS,
  STAGE_LABELS,
  getActionsByStageUnique,
  type ActionStage,
} from "@/lib/action-registry"

const STAGE_ICONS: Record<ActionStage, React.ElementType> = {
  apply: Zap,
  research: Search,
  cv: FileText,
  interview: Users,
  offer: Handshake,
  linkedin: BarChart3,
  reports: BarChart3,
}

interface AvailableActionsProps {
  appName: string
}

export function AvailableActions({ appName }: AvailableActionsProps) {
  const [expandedStages, setExpandedStages] = useState<Set<ActionStage>>(
    new Set(["apply"])
  )

  const toggleStage = (stage: ActionStage) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) {
        next.delete(stage)
      } else {
        next.add(stage)
      }
      return next
    })
  }

  const expandAll = () => setExpandedStages(new Set(STAGE_GROUPS))
  const collapseAll = () => setExpandedStages(new Set())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Available Actions
        </h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={expandAll}
          >
            Expand all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={collapseAll}
          >
            Collapse all
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {STAGE_GROUPS.map(stage => {
          const actions = getActionsByStageUnique(stage)
          if (actions.length === 0) return null
          const Icon = STAGE_ICONS[stage]
          const isExpanded = expandedStages.has(stage)

          return (
            <div
              key={stage}
              className="border border-border rounded-lg overflow-hidden bg-background"
            >
              <button
                onClick={() => toggleStage(stage)}
                className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{STAGE_LABELS[stage]}</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                    {actions.length}
                  </Badge>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {actions.map(action => (
                    <Link
                      key={action.slug}
                      href={`/actions/${action.slug}?app=${encodeURIComponent(appName)}`}
                      className="group flex items-start gap-2.5 p-2.5 rounded-md border border-border/50 hover:border-primary/50 hover:bg-accent/30 transition-all"
                    >
                      <div className="mt-0.5 shrink-0">
                        {action.hasAI ? (
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {action.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {action.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
