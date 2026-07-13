"use client"

import { useState } from "react"
import { Search, SlidersHorizontal, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const STAGES = ["applied", "interview", "offer", "rejected", "ghosted"] as const

interface FilterBarProps {
  search: string
  onSearchChange: (val: string) => void
  stageFilter: string
  onStageFilterChange: (val: string) => void
  sort: string
  onSortChange: (val: string) => void
  dateFrom: string
  onDateFromChange: (val: string) => void
  minScore: number | null
  onMinScoreChange: (val: number | null) => void
  tagFilter: string
  onTagFilterChange: (val: string) => void
  onClearAdvanced: () => void
}

export function FilterBar({
  search,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  sort,
  onSortChange,
  dateFrom,
  onDateFromChange,
  minScore,
  onMinScoreChange,
  tagFilter,
  onTagFilterChange,
  onClearAdvanced,
}: FilterBarProps) {
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const hasAdvancedFilters = dateFrom !== "" || minScore !== null || tagFilter.trim() !== ""

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <div className="relative flex-1 min-w-52">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search company or position..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={stageFilter} onValueChange={onStageFilterChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All stages" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {STAGES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="oldest">Oldest first</SelectItem>
          <SelectItem value="az">Company A to Z</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5",
              hasAdvancedFilters && "border-blue-500 text-blue-600 dark:text-blue-400"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasAdvancedFilters && (
              <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold w-4 h-4">
                {[dateFrom !== "", minScore !== null, tagFilter.trim() !== ""].filter(Boolean).length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4 space-y-4" align="end">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Advanced Filters</p>
            {hasAdvancedFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2"
                onClick={onClearAdvanced}
              >
                Clear all
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Created after
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Min ATS score
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 60"
              value={minScore ?? ""}
              onChange={(e) => {
                const val = e.target.value
                onMinScoreChange(val === "" ? null : Math.min(100, Math.max(0, parseInt(val) || 0)))
              }}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Filter by tag
            </label>
            <div className="relative">
              <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="e.g. remote"
                value={tagFilter}
                onChange={(e) => onTagFilterChange(e.target.value)}
                className="h-8 text-sm pl-7"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
