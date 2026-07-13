"use client"

import { useState, useEffect } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

export function SettingsTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data.theme) setTheme(data.theme)
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      })
      if (res.ok) {
        toast.success("Appearance saved")
      } else {
        toast.error("Failed to save appearance")
      }
    } catch {
      toast.error("Failed to save appearance")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
          <CardDescription>
            Choose your preferred color scheme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="theme-toggle">Dark mode</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Currently: <span className="font-medium capitalize">{theme}</span>
              </p>
            </div>
            <Switch
              id="theme-toggle"
              checked={theme === "dark"}
              onCheckedChange={checked => setTheme(checked ? "dark" : "light")}
            />
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
