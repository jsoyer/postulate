"use client"

import { useState, useEffect } from "react"
import { Loader2, Save, Eye, EyeOff, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

type HealthStatus = "healthy" | "degraded" | "down" | null

function HealthBadge({ status }: { status: HealthStatus }) {
  if (!status) return null
  if (status === "healthy") {
    return (
      <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800 dark:text-green-400 gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Healthy
      </Badge>
    )
  }
  if (status === "degraded") {
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400 gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
        Degraded
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1.5">
      <span className="h-2 w-2 rounded-full bg-red-300 inline-block" />
      Down
    </Badge>
  )
}

export function SettingsApiConfig() {
  const [cvApiUrl, setCvApiUrl] = useState("")
  const [cvApiKey, setCvApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data.cvApiUrl) setCvApiUrl(data.cvApiUrl)
        if (data.cvApiKey) setCvApiKey(data.cvApiKey)
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvApiUrl, cvApiKey }),
      })
      if (res.ok) {
        toast.success("Settings saved")
      } else {
        toast.error("Failed to save settings")
      }
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleHealthCheck = async () => {
    setCheckingHealth(true)
    setHealthStatus(null)
    try {
      const res = await fetch("/api/health")
      if (!res.ok) {
        setHealthStatus("down")
        return
      }
      const data = await res.json()
      setHealthStatus(data.status ?? (res.ok ? "healthy" : "down"))
    } catch {
      setHealthStatus("down")
    } finally {
      setCheckingHealth(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CV API Connection</CardTitle>
          <CardDescription>
            Configure the connection to your CV API backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cv-api-url">CV API URL</Label>
            <Input
              id="cv-api-url"
              type="url"
              value={cvApiUrl}
              onChange={e => setCvApiUrl(e.target.value)}
              placeholder="http://localhost:3001"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cv-api-key">CV API Key</Label>
            <div className="relative">
              <Input
                id="cv-api-key"
                type={showApiKey ? "text" : "password"}
                value={cvApiKey}
                onChange={e => setCvApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Health Check</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify API connectivity
              </p>
            </div>
            <div className="flex items-center gap-3">
              <HealthBadge status={healthStatus} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleHealthCheck}
                disabled={checkingHealth}
              >
                {checkingHealth ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5" />
                )}
                Check
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </Button>
      </div>
    </div>
  )
}
