"use client"

import { Loader2, Trash2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

interface PasskeyInfo {
  id: string
  deviceName: string
  createdAt: string
}

interface PasskeyListProps {
  passkeys: PasskeyInfo[]
  loading: boolean
  deletingId: string | null
  onDelete: (id: string) => void
}

export function PasskeyList({ passkeys, loading, deletingId, onDelete }: PasskeyListProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading passkeys…
      </div>
    )
  }

  if (passkeys.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No passkeys registered.</p>
  }

  return (
    <div className="space-y-2">
      {passkeys.map((pk) => (
        <div
          key={pk.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-4 h-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {pk.deviceName}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Added {new Date(pk.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => onDelete(pk.id)}
            disabled={deletingId === pk.id}
          >
            {deletingId === pk.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      ))}
    </div>
  )
}
