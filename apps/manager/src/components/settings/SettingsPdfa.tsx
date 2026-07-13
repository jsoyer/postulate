"use client"

import { useState, useEffect } from "react"
import { Loader2, FileText } from "lucide-react"
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

export function SettingsPdfa() {
  const [pdfaEnabled, setPdfaEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data.pdfa_enabled !== undefined) setPdfaEnabled(data.pdfa_enabled)
      })
      .catch(() => {})
  }, [])

  const handleToggle = async (checked: boolean) => {
    setPdfaEnabled(checked)
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfa_enabled: checked }),
      })
      if (res.ok) {
        toast.success("PDF/A setting updated")
      } else {
        toast.error("Failed to update PDF/A setting")
        setPdfaEnabled(!checked)
      }
    } catch {
      toast.error("Failed to update PDF/A setting")
      setPdfaEnabled(!checked)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF/A Accessibility</CardTitle>
          <CardDescription>
            Generate PDF/A-2b compliant PDFs for better ATS parsing and WCAG accessibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pdfa-toggle">Enable PDF/A generation</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When enabled, all CV PDFs include embedded fonts, metadata, and tagged structure.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Switch
                id="pdfa-toggle"
                checked={pdfaEnabled}
                onCheckedChange={handleToggle}
                disabled={saving}
              />
            </div>
          </div>

          <div className="rounded-md bg-slate-50 dark:bg-slate-800 p-3 text-xs space-y-1">
            <p className="font-medium text-slate-700 dark:text-slate-300">What PDF/A adds:</p>
            <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 space-y-0.5">
              <li>Embedded fonts for consistent rendering</li>
              <li>Document metadata (title, author, keywords)</li>
              <li>Tagged PDF structure for screen readers</li>
              <li>sRGB color space specification</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
