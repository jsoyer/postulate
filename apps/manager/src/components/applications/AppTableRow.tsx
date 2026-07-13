"use client"

import { Pencil, AlertTriangle, Tag, ChevronDown, ExternalLink } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TableCell, TableRow } from "@/components/ui/table"
import { TagCells, ScoreBadge } from "./ApplicationRow"

function MatchBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums min-w-[2.5rem]",
        score >= 70
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
          : score >= 50
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
          : "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300"
      )}
    >
      {score}
    </span>
  )
}

const STAGES = ["applied", "interview", "offer", "rejected", "ghosted"] as const
const STAGE_VARIANT: Record<string, "applied" | "interview" | "offer" | "rejected" | "ghosted"> = {
  applied: "applied", interview: "interview", offer: "offer", rejected: "rejected", ghosted: "ghosted",
}

interface Application {
  name: string; company: string; position: string; created: string; stage: string; deadline?: string; files: string[]
}

interface AppTableRowProps {
  app: Application; score: number | undefined; jobMatchScore: number | undefined; tags: string[]; deadlineThreshold: Date
  isSelected: boolean; isEditingCompany: boolean; isEditingPosition: boolean; editValue: string
  editInputRef: React.RefObject<HTMLInputElement | null>; updatingStage: string | null
  onSelect: () => void; onStartEdit: (field: "company" | "position") => void
  onSaveEdit: () => void; onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onUpdateStage: (stage: string) => void; onEditTags: () => void
}

export function AppTableRow({
  app, score, jobMatchScore, tags, deadlineThreshold, isSelected, isEditingCompany, isEditingPosition,
  editValue, editInputRef, updatingStage, onSelect, onStartEdit, onSaveEdit, onEditKeyDown, onUpdateStage, onEditTags,
}: AppTableRowProps) {
  const isDeadlineSoon = app.deadline && new Date(app.deadline) <= deadlineThreshold
  return (
    <TableRow data-state={isSelected ? "selected" : undefined} className={cn("group transition-colors", isSelected && "bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/60")}>
      <TableCell className="pl-4 pr-2">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} aria-label={`Select ${app.company}`} />
      </TableCell>
      <TableCell className="py-3">
        {isEditingCompany ? (
          <Input ref={editInputRef} value={editValue} onChange={() => onSaveEdit()} onBlur={onSaveEdit} onKeyDown={onEditKeyDown} className="h-7 text-sm px-2 w-40" />
        ) : (
          <div className="flex items-center gap-1.5 cursor-pointer group/edit" onClick={() => onStartEdit("company")} title="Click to edit">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{app.company}</span>
            <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover/edit:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
        <div className="text-xs text-slate-400 font-mono mt-0.5">{app.name}</div>
        {isDeadlineSoon && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Due {app.deadline}</span>
          </div>
        )}
      </TableCell>
      <TableCell className="py-3 max-w-xs">
        {isEditingPosition ? (
          <Input ref={editInputRef} value={editValue} onChange={() => onSaveEdit()} onBlur={onSaveEdit} onKeyDown={onEditKeyDown} className="h-7 text-sm px-2 w-full" />
        ) : (
          <div className="flex items-center gap-1.5 cursor-pointer group/edit" onClick={() => onStartEdit("position")} title="Click to edit">
            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{app.position}</span>
            <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover/edit:opacity-100 transition-opacity shrink-0" />
          </div>
        )}
      </TableCell>
      <TableCell className="py-3">
        <Select value={app.stage} onValueChange={onUpdateStage} disabled={updatingStage === app.name}>
          <SelectTrigger className="h-7 w-28 border-0 bg-transparent px-0 focus:ring-0 focus:ring-offset-0 [&>svg]:ml-1">
            <Badge variant={STAGE_VARIANT[app.stage] ?? "secondary"} className="capitalize cursor-pointer">{app.stage}</Badge>
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (<SelectItem key={s} value={s}><Badge variant={STAGE_VARIANT[s]} className="capitalize">{s}</Badge></SelectItem>))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-1.5">
          <TagCells tags={tags} />
          <button type="button" onClick={onEditTags} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0" aria-label="Edit tags" title="Edit tags">
            <Tag className="w-3 h-3" />
          </button>
        </div>
      </TableCell>
      <TableCell className="py-3">
        {score !== undefined ? <ScoreBadge score={score} /> : <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">—</span>}
      </TableCell>
      <TableCell className="py-3">
        {jobMatchScore !== undefined ? <MatchBadge score={jobMatchScore} /> : <span className="text-slate-300 dark:text-slate-600 text-xs font-mono">—</span>}
      </TableCell>
      <TableCell className="py-3 text-sm text-slate-500 dark:text-slate-400 tabular-nums">{app.created}</TableCell>
      <TableCell className="py-3 text-right pr-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">View <ChevronDown className="w-3 h-3 ml-1" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={`/applications/${app.name}`} className="gap-2"><ExternalLink className="w-3.5 h-3.5" /> Open</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEditTags} className="gap-2"><Tag className="w-3.5 h-3.5" /> Edit Tags</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
