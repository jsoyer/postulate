"use client"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AppTableRow } from "./AppTableRow"

interface Application {
  name: string
  company: string
  position: string
  created: string
  stage: string
  deadline?: string
  files: string[]
}

interface ApplicationTableProps {
  applications: Application[]
  selected: Set<string>
  atsScores: Record<string, number | undefined>
  jobMatchScores: Record<string, number | undefined>
  appTags: Record<string, string[]>
  deadlineThreshold: Date
  editingCell: { name: string; field: "company" | "position" } | null
  editValue: string
  editInputRef: React.RefObject<HTMLInputElement | null>
  updatingStage: string | null
  onSelectAll: () => void
  onSelectOne: (name: string) => void
  onStartEdit: (name: string, field: "company" | "position", value: string) => void
  onSaveEdit: () => void
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onUpdateStage: (name: string, stage: string) => void
  onEditTags: (name: string) => void
}

export function ApplicationTable({
  applications,
  selected,
  atsScores,
  jobMatchScores,
  appTags,
  deadlineThreshold,
  editingCell,
  editValue,
  editInputRef,
  updatingStage,
  onSelectAll,
  onSelectOne,
  onStartEdit,
  onSaveEdit,
  onEditKeyDown,
  onUpdateStage,
  onEditTags,
}: ApplicationTableProps) {
  const allSelected = applications.length > 0 && applications.every((a) => selected.has(a.name))

  return (
    <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900/80">
            <TableHead className="w-10 pl-4">
              <Checkbox checked={allSelected} onCheckedChange={onSelectAll} aria-label="Select all" />
            </TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Company</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Position</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Stage</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Tags</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Score</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Match</TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Created</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => {
            const isSelected = selected.has(app.name)
            const isEditingCompany = editingCell?.name === app.name && editingCell.field === "company"
            const isEditingPosition = editingCell?.name === app.name && editingCell.field === "position"

            return (
              <AppTableRow
                key={app.name}
                app={app}
                score={atsScores[app.name]}
                jobMatchScore={jobMatchScores[app.name]}
                tags={appTags[app.name] ?? []}
                deadlineThreshold={deadlineThreshold}
                isSelected={isSelected}
                isEditingCompany={isEditingCompany}
                isEditingPosition={isEditingPosition}
                editValue={editValue}
                editInputRef={editInputRef}
                updatingStage={updatingStage}
                onSelect={() => onSelectOne(app.name)}
                onStartEdit={(field) => onStartEdit(app.name, field, field === "company" ? app.company : app.position)}
                onSaveEdit={onSaveEdit}
                onEditKeyDown={onEditKeyDown}
                onUpdateStage={(stage) => onUpdateStage(app.name, stage)}
                onEditTags={() => onEditTags(app.name)}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
