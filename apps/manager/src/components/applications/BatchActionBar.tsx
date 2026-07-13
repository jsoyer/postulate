"use client"

import { Target, X, ChevronDown, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STAGES = ["applied", "interview", "offer", "rejected", "ghosted"] as const

const STAGE_VARIANT: Record<string, "applied" | "interview" | "offer" | "rejected" | "ghosted"> = {
  applied: "applied",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
  ghosted: "ghosted",
}

interface BatchActionBarProps {
  selectedCount: number
  batchRunning: boolean
  onBatchScore: () => void
  onBatchJobMatch: () => void
  onBatchStageChange: (stage: string) => void
  onClear: () => void
}

export function BatchActionBar({
  selectedCount,
  batchRunning,
  onBatchScore,
  onBatchJobMatch,
  onBatchStageChange,
  onClear,
}: BatchActionBarProps) {
  return (
    <div className="sticky bottom-4 z-10 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 rounded-xl shadow-lg shadow-blue-900/10 animate-in slide-in-from-bottom-3 duration-200 backdrop-blur-sm">
      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
        {selectedCount} selected
      </span>
      <div className="w-px h-4 bg-blue-200 dark:bg-blue-700" />
      <Button
        size="sm"
        variant="default"
        onClick={onBatchScore}
        disabled={batchRunning}
        className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
      >
        <Target className="w-3 h-3 mr-1.5" />
        {batchRunning ? "Scoring..." : "ATS Score all"}
      </Button>

      <Button
        size="sm"
        variant="default"
        onClick={onBatchJobMatch}
        disabled={batchRunning}
        className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
      >
        <Zap className="w-3 h-3 mr-1.5" />
        {batchRunning ? "Matching..." : "Job Match all"}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={batchRunning}
            className="h-7 text-xs border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
          >
            Set stage
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="text-xs text-slate-500">Move all selected to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STAGES.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => onBatchStageChange(s)}
              className="gap-2"
            >
              <Badge variant={STAGE_VARIANT[s]} className="capitalize text-xs">
                {s}
              </Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        className="ml-auto h-7 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <X className="w-3 h-3 mr-1" />
        Clear
      </Button>
    </div>
  )
}
