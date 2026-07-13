"use client"

import { useState, useEffect } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProviderStatusCard } from "./ProviderStatusCard"
import { ApiKeyConfigCard } from "./ApiKeyConfigCard"
import { toast } from "sonner"

export function SettingsAI() {
  const [defaultAI, setDefaultAI] = useState<string>("gemini")
  const [defaultModel, setDefaultModel] = useState<string>("")
  const [savingAI, setSavingAI] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data.default_ai) setDefaultAI(data.default_ai)
        if (data.default_model !== undefined) setDefaultModel(data.default_model ?? "")
      })
      .catch(() => {})
  }, [])

  const handleSave = async (overrides?: { default_ai?: string; default_model?: string }) => {
    setSavingAI(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_ai: overrides?.default_ai ?? defaultAI,
          default_model: overrides?.default_model !== undefined ? overrides.default_model : defaultModel,
        }),
      })
      if (res.ok) {
        toast.success("AI settings saved")
      } else {
        toast.error("Failed to save AI settings")
      }
    } catch {
      toast.error("Failed to save AI settings")
    } finally {
      setSavingAI(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default AI Provider</CardTitle>
          <CardDescription>
            The AI provider used by default for all action pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="default-ai-select">Provider</Label>
            <Select
              value={defaultAI}
              onValueChange={val => {
                setDefaultAI(val)
                handleSave({ default_ai: val })
              }}
            >
              <SelectTrigger id="default-ai-select" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini (default)</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="mistral">Mistral</SelectItem>
                <SelectItem value="ollama">Ollama (local)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Model</CardTitle>
          <CardDescription>
            Override the model used by the selected provider. Leave empty to use the provider default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="default-model-input">Model</Label>
            <Input
              id="default-model-input"
              type="text"
              value={defaultModel}
              onChange={e => setDefaultModel(e.target.value)}
              onBlur={() => handleSave({ default_model: defaultModel })}
              onKeyDown={e => {
                if (e.key === "Enter") handleSave({ default_model: defaultModel })
              }}
              placeholder="Leave empty for provider default"
              className="w-56"
            />
          </div>
        </CardContent>
      </Card>

      <ProviderStatusCard />
      <ApiKeyConfigCard />

      <div className="flex justify-end">
        <Button onClick={() => handleSave()} disabled={savingAI}>
          {savingAI ? (
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
