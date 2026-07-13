"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Loader2, Play, Square, Copy, CheckCircle2, XCircle, Terminal } from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { useSelectedApp } from "@/components/SelectedAppContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRecordAction, useUpdatePreferences } from "@/lib/api-hooks"

export interface ActionField {
  name: string
  label: string
  placeholder?: string
  type?: "text" | "number" | "url" | "select"
  required?: boolean
  options?: Array<{ value: string; label: string }>
  defaultValue?: string
}

interface ActionRunnerProps {
  action: string
  title: string
  description?: string
  fields: ActionField[]
  onSuccess?: () => void
}

interface OutputLine {
  type: "stdout" | "stderr" | "error" | "info"
  line: string
}

const MERMAID_PREFIXES = ["graph ", "gantt", "flowchart ", "sequenceDiagram", "classDiagram", "pie "]

function isMermaid(lines: OutputLine[]): string | null {
  const text = lines.filter(l => l.type === "stdout").map(l => l.line).join("\n")
  if (MERMAID_PREFIXES.some(p => text.includes(p))) {
    const match = text.match(/(graph[\s\S]+|gantt[\s\S]+|flowchart[\s\S]+|sequenceDiagram[\s\S]+|pie[\s\S]+)/m)
    return match ? match[1] : null
  }
  return null
}

type RunStatus = "idle" | "running" | "completed" | "failed"

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "idle") return null
  if (status === "running") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        Running
      </Badge>
    )
  }
  if (status === "completed") {
    return (
      <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 dark:border-green-800 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3" />
        Completed
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1.5">
      <XCircle className="w-3 h-3" />
      Failed
    </Badge>
  )
}

export function ActionRunner({ action, title, description, fields, onSuccess }: ActionRunnerProps) {
  const { selectedApp } = useSelectedApp()
  const recordAction = useRecordAction()
  const updatePreferences = useUpdatePreferences()

  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const f of fields) {
      if (f.defaultValue) {
        defaults[f.name] = f.defaultValue
      } else if (f.name === "NAME" && selectedApp?.name) {
        defaults[f.name] = selectedApp.name
      }
    }
    return defaults
  })

  const [status, setStatus] = useState<RunStatus>("idle")
  const [lines, setLines] = useState<OutputLine[]>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fallbackNotifiedRef = useRef(false)
  const touchedFields = useRef<Set<string>>(new Set())
  const { notify } = usePushNotifications()

  // Sync defaultValue changes (e.g. from async useDefaultAI resolution) for untouched fields
  useEffect(() => {
    setFormData(prev => {
      const next = { ...prev }
      let changed = false
      for (const f of fields) {
        if (f.defaultValue !== undefined && !touchedFields.current.has(f.name)) {
          if (next[f.name] !== f.defaultValue) {
            next[f.name] = f.defaultValue
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [fields])

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [lines])

  // Keep a ref to the viewport inside ScrollArea
  const attachViewportRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const viewport = node.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null
      if (viewport) viewportRef.current = viewport
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("running")
    setLines([])
    fallbackNotifiedRef.current = false

    abortRef.current = new AbortController()

    const payload: Record<string, string> = { target: action }
    for (const [k, v] of Object.entries(formData)) {
      if (v && v.trim()) payload[k] = v.trim()
    }

    try {
      const res = await fetch("/api/actions/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Stream failed" }))
        setLines([{ type: "error", line: err.error || "Request failed" }])
        setStatus("failed")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const collectedLines: OutputLine[] = []

      while (true) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break

        const text = decoder.decode(value, { stream: true })
        for (const rawLine of text.split("\n")) {
          if (!rawLine.startsWith("data: ")) continue
          try {
            const event = JSON.parse(rawLine.slice(6))
            if (event.type === "done") {
              const success = event.code === 0 || event.code === null
              setStatus(success ? "completed" : "failed")
              notify(action, success ? "Completed" : "Failed")
              try {
                await recordAction.mutateAsync({
                  action,
                  params: formData,
                  timestamp: Date.now(),
                  success,
                })
              } catch {}
              if (success) {
                const applicationName = formData["name"] || formData["NAME"] || formData["application"]
                const aiProvider = formData["ai"]
                if (applicationName && aiProvider) {
                  try {
                    await updatePreferences.mutateAsync({
                      name: applicationName,
                      prefs: { ai_provider: aiProvider },
                    })
                  } catch {}
                }
                if (onSuccess) onSuccess()
              }
            } else if (event.type === "error") {
              const newLine = { type: "error" as const, line: event.line }
              setLines(prev => [...prev, newLine])
              collectedLines.push(newLine)
            } else if (event.line) {
              const newLine = { type: event.type as "stdout" | "stderr", line: event.line }
              if (
                event.type === "stderr" &&
                !fallbackNotifiedRef.current &&
                /fallback|retrying with|switching to/i.test(event.line as string)
              ) {
                fallbackNotifiedRef.current = true
                toast.warning("AI provider fallback detected — switching to backup provider")
              }
              setLines(prev => [...prev, newLine])
              collectedLines.push(newLine)
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setLines(prev => [...prev, { type: "error", line: err.message }])
        setStatus("failed")
        notify(action, "Failed")
      } else {
        setStatus("idle")
      }
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleCopy = () => {
    const text = lines.filter(l => l.type === "stdout").map(l => l.line).join("\n")
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied")
    }).catch(() => {
      toast.error("Copy failed")
    })
  }

  const running = status === "running"
  const mermaidContent = status === "completed" ? isMermaid(lines) : null

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {description && (
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(field => (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={`field-${field.name}`}>
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.type === "select" ? (
              <Select
                value={formData[field.name] || ""}
                onValueChange={val => {
                  touchedFields.current.add(field.name)
                  setFormData(p => ({ ...p, [field.name]: val }))
                }}
                required={field.required}
              >
                <SelectTrigger id={`field-${field.name}`}>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`field-${field.name}`}
                type={field.type || "text"}
                value={formData[field.name] || ""}
                onChange={e => {
                  touchedFields.current.add(field.name)
                  setFormData(p => ({ ...p, [field.name]: e.target.value }))
                }}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={running}>
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run
              </>
            )}
          </Button>
          {running && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              <Square className="w-4 h-4" />
              Cancel
            </Button>
          )}
          <StatusBadge status={status} />
        </div>
      </form>

      {lines.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Terminal className="w-4 h-4" />
              <span aria-live="polite" aria-atomic="true" className="sr-only">
                {status === "completed" ? "Action completed successfully" : status === "failed" ? "Action failed" : running ? "Action running" : ""}
              </span>
              Output
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
          <div
            ref={attachViewportRef}
            className="rounded-lg border border-slate-700 overflow-hidden"
          >
            <ScrollArea className="h-96 bg-slate-950">
              <div className="p-4 font-mono text-xs space-y-0.5">
                {lines.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      l.type === "stderr" && "text-amber-400",
                      l.type === "error" && "text-red-400",
                      l.type === "stdout" && "text-green-400",
                      l.type === "info" && "text-slate-400"
                    )}
                  >
                    {l.line}
                  </div>
                ))}
                {running && (
                  <div className="text-slate-500 animate-[blink_1s_step-end_infinite]">
                    ▋
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {mermaidContent && <MermaidDiagram content={mermaidContent} />}
    </div>
  )
}

function MermaidDiagram({ content }: { content: string }) {
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" })
        const id = `mermaid-${Date.now()}`
        const { svg: renderedSvg } = await mermaid.render(id, content)
        if (!cancelled) setSvg(renderedSvg)
      } catch (e) {
        console.error("Mermaid render error", e)
        if (!cancelled) setError(true)
      }
    }
    render()
    return () => { cancelled = true }
  }, [content])

  if (error) return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">Diagram could not be rendered.</p>
    </div>
  )
  if (!svg) return null
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 overflow-auto">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Diagram</h3>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
