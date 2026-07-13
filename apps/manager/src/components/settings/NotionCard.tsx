"use client"

import { useState, useCallback } from "react"
import { Loader2, Save, Eye, EyeOff, Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

interface NotionCardProps {
  configured: boolean
  databaseId: string
  onSave: (token: string, databaseId: string) => void
  onDisconnect: () => void
}

export function NotionCard({ configured, databaseId, onSave, onDisconnect }: NotionCardProps) {
  const [token, setToken] = useState("")
  const [dbInput, setDbInput] = useState(databaseId)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const handleSave = async () => {
    if (!token.trim() || !dbInput.trim()) {
      toast.error("Both Notion token and database ID are required")
      return
    }
    setSaving(true)
    try {
      await onSave(token.trim(), dbInput.trim())
      setToken("")
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Notion</CardTitle>
            <CardDescription>Sync your CV data with a Notion database.</CardDescription>
          </div>
          {configured ? (
            <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 dark:border-green-800 dark:text-green-400 shrink-0">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-slate-500 border-slate-200 dark:border-slate-700 shrink-0">
              <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
              Not configured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {configured && databaseId && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Database ID: <span className="font-mono">{databaseId}</span>
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="notion-token">Notion Token</Label>
            <div className="relative">
              <Input
                id="notion-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="secret_..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notion-db-id">Database ID</Label>
            <Input
              id="notion-db-id"
              type="text"
              value={dbInput}
              onChange={(e) => setDbInput(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Create a Notion integration at{" "}
            <a href="https://notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
              notion.so/my-integrations
            </a>
            , share your database with it, and paste the token here.
          </p>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
            {configured && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
