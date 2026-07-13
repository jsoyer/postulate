"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Briefcase,
  Loader2,
  ArrowLeft,
  Globe,
  Play,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutputLine {
  type: "stdout" | "stderr" | "error" | "info"
  line: string
}

// ─── Import from URL section ──────────────────────────────────────────────────

function ImportSection({ onImportSuccess }: { onImportSuccess: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [importName, setImportName] = useState("")
  const [importCompany, setImportCompany] = useState("")
  const [importPosition, setImportPosition] = useState("")
  const [importUrl, setImportUrl] = useState("")
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lines, setLines] = useState<OutputLine[]>([])
  const outputRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  useEffect(() => {
    if (importCompany && importPosition) {
      const today = new Date().toISOString().slice(0, 10)
      const slug = `${today}-${importCompany
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${importPosition
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`
      setImportName(slug.slice(0, 80))
    }
  }, [importCompany, importPosition])

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importCompany || !importPosition || !importUrl) return
    setRunning(true)
    setDone(false)
    setFailed(false)
    setLines([])

    abortRef.current = new AbortController()

    try {
      setLines([{ type: "info", line: "Creating application..." }])
      const createRes = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: importCompany,
          position: importPosition,
          url: importUrl,
        }),
        signal: abortRef.current.signal,
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        setLines((prev) => [
          ...prev,
          { type: "error", line: createData.error || "Failed to create application" },
        ])
        setFailed(true)
        setRunning(false)
        return
      }
      setLines((prev) => [
        ...prev,
        { type: "info", line: `Application created: ${importName}` },
      ])

      setLines((prev) => [
        ...prev,
        { type: "info", line: "Fetching job details from URL..." },
      ])
      const streamRes = await fetch("/api/actions/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "fetch", NAME: importName, URL: importUrl }),
        signal: abortRef.current.signal,
      })

      if (!streamRes.ok || !streamRes.body) {
        const err = await streamRes.json().catch(() => ({ error: "Stream failed" }))
        setLines((prev) => [
          ...prev,
          { type: "error", line: err.error || "Stream request failed" },
        ])
        setFailed(true)
        setRunning(false)
        return
      }

      const reader = streamRes.body.getReader()
      const decoder = new TextDecoder()
      const finalName = importName

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
              setDone(true)
              setFailed(!success)
              setRunning(false)
              if (success) {
                onImportSuccess(finalName)
              }
            } else if (event.line) {
              setLines((prev) => [
                ...prev,
                { type: event.type as "stdout" | "stderr" | "error", line: event.line },
              ])
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      const error = err as Error
      if (error.name !== "AbortError") {
        setLines((prev) => [...prev, { type: "error", line: error.message }])
        setFailed(true)
      }
      setRunning(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-controls="import-section-content"
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
            <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Import from URL
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              LinkedIn, Indeed, or any job posting URL
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div id="import-section-content" className="border-t border-slate-100 dark:border-slate-800">
          <CardContent className="pt-5">
            <form onSubmit={handleImport} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="import-company">Company *</Label>
                  <Input
                    id="import-company"
                    type="text"
                    value={importCompany}
                    onChange={(e) => setImportCompany(e.target.value)}
                    placeholder="e.g. Snowflake"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="import-position">Position *</Label>
                  <Input
                    id="import-position"
                    type="text"
                    value={importPosition}
                    onChange={(e) => setImportPosition(e.target.value)}
                    placeholder="e.g. Senior Engineer"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="import-url">Job URL *</Label>
                <Input
                  id="import-url"
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/view/..."
                  required
                />
              </div>
              {importName && (
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  Slug: {importName}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={running || !importCompany || !importPosition || !importUrl}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  size="sm"
                >
                  {running ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-1.5" />
                  )}
                  {running ? "Importing..." : "Import"}
                </Button>
                {done && !failed && (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Done — redirecting...
                  </span>
                )}
                {failed && (
                  <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    Failed
                  </span>
                )}
              </div>
            </form>

            {lines.length > 0 && (
              <div
                ref={outputRef}
                className="mt-4 bg-slate-950 rounded-lg p-4 font-mono text-xs max-h-48 overflow-y-auto space-y-0.5 border border-slate-800"
              >
                {lines.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      l.type === "stderr"
                        ? "text-amber-400"
                        : l.type === "error"
                        ? "text-red-400"
                        : l.type === "info"
                        ? "text-slate-400"
                        : "text-emerald-300"
                    )}
                  >
                    {l.line}
                  </div>
                ))}
                {running && <div className="text-slate-500 animate-pulse">▋</div>}
              </div>
            )}
          </CardContent>
        </div>
      )}
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface FormErrors {
  company?: string
  position?: string
}

export default function NewApplicationPage() {
  const router = useRouter()
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [url, setUrl] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates")
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: { company: string; position: string; url?: string }) => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to create application")
      return json
    },
    onSuccess: (data) => {
      const name = data?.name
      if (name) {
        router.push(`/applications/${name}`)
      } else {
        router.push("/applications")
      }
    },
    onError: (err: Error) => {
      toast.error("Failed to create application", {
        description: err.message,
      })
    },
  })

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!company.trim()) next.company = "Company is required"
    if (!position.trim()) next.position = "Position is required"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    createMutation.mutate({
      company: company.trim(),
      position: position.trim(),
      url: url.trim() || undefined,
    })
  }

  const handleImportSuccess = (name: string) => {
    setTimeout(() => {
      router.push(`/applications/${name}`)
    }, 1000)
  }

  const loadTemplate = (templateName: string) => {
    const t = (templates as { name: string; template?: { position?: string } }[])?.find(
      (t) => t.name === templateName
    )
    if (t?.template?.position) {
      setPosition(t.template.position)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0" aria-label="Back to applications">
          <Link href="/applications">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            New Application
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create manually or import from a job posting URL
          </p>
        </div>
      </div>

      {/* Import from URL */}
      <ImportSection onImportSuccess={handleImportSuccess} />

      {/* Manual create */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50">
              <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-lg">Create manually</CardTitle>
          </div>
        </CardHeader>

        {templates && (templates as { name: string }[]).length > 0 && (
          <>
            <CardContent className="pt-0 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="template-select">Load template</Label>
                <Select onValueChange={(val) => { if (val) loadTemplate(val) }}>
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates as { name: string }[]).map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <Separator />
          </>
        )}

        <CardContent className={cn(templates && (templates as unknown[]).length > 0 ? "pt-4" : "pt-0")}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company */}
            <div className="space-y-1.5">
              <Label htmlFor="company">
                Company <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company"
                type="text"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value)
                  if (errors.company) setErrors((prev) => ({ ...prev, company: undefined }))
                }}
                placeholder="e.g. Snowflake"
                aria-required="true"
                aria-invalid={!!errors.company}
                aria-describedby={errors.company ? "company-error" : undefined}
                className={cn(errors.company && "border-red-500 focus-visible:ring-red-500")}
              />
              {errors.company && (
                <p id="company-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {errors.company}
                </p>
              )}
            </div>

            {/* Position */}
            <div className="space-y-1.5">
              <Label htmlFor="position">
                Position <span className="text-red-500">*</span>
              </Label>
              <Input
                id="position"
                type="text"
                value={position}
                onChange={(e) => {
                  setPosition(e.target.value)
                  if (errors.position) setErrors((prev) => ({ ...prev, position: undefined }))
                }}
                placeholder="e.g. Senior Director of Sales Engineering"
                aria-required="true"
                aria-invalid={!!errors.position}
                aria-describedby={errors.position ? "position-error" : undefined}
                className={cn(errors.position && "border-red-500 focus-visible:ring-red-500")}
              />
              {errors.position && (
                <p id="position-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {errors.position}
                </p>
              )}
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label htmlFor="url">
                Job URL{" "}
                <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
              </Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="min-w-36"
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                )}
                {createMutation.isPending ? "Creating..." : "Create Application"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/applications">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
