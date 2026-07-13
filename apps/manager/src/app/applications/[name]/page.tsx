"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, FileText, Globe, Zap, Target, BookOpen, Bot,
  DollarSign, UserSearch, CheckSquare, Archive, ListChecks,
  Calendar, Mail, Handshake, Building2, Map, Eye, Download,
  Upload, CheckCircle2, Copy, Check, BookMarked, AlertTriangle,
  Clock, LayoutGrid, FolderOpen, FlaskConical, StickyNote, GitCommitHorizontal,
  FileCode, File, Trash2,
} from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TimelineView } from "@/components/TimelineView"
import type { TimelineEvent } from "@/components/TimelineView"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { useAtsScores, usePreferences } from "@/lib/api-hooks"
import { AvailableActions } from "@/components/applications/AvailableActions"
import { RecentActions } from "@/components/applications/RecentActions"
import { JobMatchCard } from "@/components/applications/JobMatchCard"

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ["applied", "interview", "offer", "rejected", "ghosted"] as const
type Stage = typeof STAGES[number]

const FILE_LABELS: Record<string, string> = {
  "job.txt": "Job description",
  "cv-tailored.yml": "Tailored CV (YAML)",
  "coverletter.yml": "Cover letter (YAML)",
  "prep.md": "Interview prep",
  "company-research.md": "Company research",
  "contacts.md": "Contacts",
  "competitors.md": "Competitor map",
  "job-fit.md": "Job fit score",
  "star-stories.md": "STAR stories",
  "interview-brief.md": "Interview brief",
  "salary-bench.md": "Salary benchmark",
  "cover-angles.md": "Cover letter angles",
  "linkedin-message.md": "LinkedIn message",
  "recruiter-email.md": "Recruiter email",
  "thankyou.md": "Thank-you email",
  "negotiate.md": "Negotiation script",
  "followup.md": "Follow-up email",
  "linkedin-post.md": "LinkedIn post",
  "linkedin-profile.md": "LinkedIn profile",
  "milestones.yml": "Milestones",
}

const QUICK_COPY_KEYS = [
  "recruiter-email", "thankyou", "linkedin-message", "followup",
  "negotiate", "cover-angles", "linkedin-post", "linkedin-profile", "star-stories",
]

const QUICK_COPY_LABELS: Record<string, string> = {
  "recruiter-email": "Recruiter Email",
  "thankyou": "Thank-You Email",
  "linkedin-message": "LinkedIn Message",
  "followup": "Follow-up Email",
  "negotiate": "Negotiation Script",
  "cover-angles": "Cover Letter Angles",
  "linkedin-post": "LinkedIn Post",
  "linkedin-profile": "LinkedIn Profile",
  "star-stories": "STAR Stories",
}

interface Milestone {
  date?: string | number
  event?: string
  [key: string]: unknown
}

// ─── ATS Score History ────────────────────────────────────────────────────────

function AtsScoreHistory({ name }: { name: string }) {
  const { data } = useAtsScores(name)
  const history = data?.history ?? []

  if (history.length === 0) return null

  const latest = history[history.length - 1].score
  const scoreColor = latest >= 70
    ? "text-green-600 dark:text-green-400"
    : latest >= 50
    ? "text-yellow-600 dark:text-yellow-400"
    : "text-red-600 dark:text-red-400"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          ATS Score History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-4">
          <span className={cn("text-4xl font-bold tabular-nums", scoreColor)}>{latest}</span>
          <span className="text-sm text-muted-foreground">/ 100 &mdash; current score</span>
        </div>
        {history.length >= 2 && (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart
              data={history.map((h, i) => ({
                index: i + 1,
                score: h.score,
                date: new Date(h.date).toLocaleDateString(),
              }))}
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15,23,42,0.92)",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "11px",
                }}
                itemStyle={{ color: "#60a5fa" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 3 }}
                name="ATS Score"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Skills Gap ───────────────────────────────────────────────────────────────

function SkillsGapSection({ name }: { name: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["skills-gap", name],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${name}/skills-gap`)
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Skills Gap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-1.5">
            {[80, 60, 100, 72, 55].map(w => (
              <Skeleton key={w} className="h-5 rounded-full" style={{ width: w }} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const missing: string[] = data?.missing || []
  const present: string[] = data?.present || []

  if (missing.length === 0 && present.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Skills Gap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
              Missing from your CV
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map(w => (
                <Badge key={w} className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-transparent text-xs">
                  {w}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {present.length > 0 && (
          <div>
            <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">
              Already in your CV
            </p>
            <div className="flex flex-wrap gap-1.5">
              {present.map(w => (
                <Badge key={w} className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-transparent text-xs">
                  {w}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Follow-up Reminder ───────────────────────────────────────────────────────

function FollowupReminder({ name, initialDate }: { name: string; initialDate?: string }) {
  const [date, setDate] = useState(initialDate || "")
  const [saved, setSaved] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDate(val)
    try {
      await fetch(`/api/applications/${name}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followup_date: val }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error("Failed to save follow-up date")
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="followup-date" className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            Follow-up Reminder
          </Label>
          <span
            className={cn(
              "text-xs text-green-600 dark:text-green-400 flex items-center gap-1 transition-opacity duration-300",
              saved ? "opacity-100" : "opacity-0"
            )}
          >
            <CheckCircle2 className="w-3 h-3" /> Saved
          </span>
        </div>
        <Input
          id="followup-date"
          type="date"
          value={date}
          onChange={handleChange}
          className="text-sm"
        />
      </CardContent>
    </Card>
  )
}

// ─── Stage Selector ───────────────────────────────────────────────────────────

function StageSelector({
  stage,
  updating,
  onSelect,
}: {
  stage: Stage
  updating: boolean
  onSelect: (s: Stage) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGES.map(s => (
        <Button
          key={s}
          size="sm"
          disabled={updating}
          onClick={() => onSelect(s)}
          className={cn(
            "capitalize h-8 px-3 text-xs font-medium transition-all",
            stage === s
              ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
              : "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {s}
        </Button>
      ))}
    </div>
  )
}

// ─── Quick Copy ───────────────────────────────────────────────────────────────

function QuickCopySection({ data }: { data: Record<string, unknown> }) {
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set())

  const availableKeys = QUICK_COPY_KEYS.filter(k => typeof data[k] === "string" && data[k])
  if (availableKeys.length === 0) return null

  const handleCopy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(data[key] as string)
      setCopiedKeys(prev => new Set(prev).add(key))
      toast.success(`Copied: ${QUICK_COPY_LABELS[key] || key}`)
      setTimeout(() => {
        setCopiedKeys(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }, 2000)
    } catch {
      toast.error("Clipboard access denied")
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
        Quick Copy
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {availableKeys.map(key => (
          <div
            key={key}
            className="flex items-center justify-between p-3 bg-background border border-border rounded-lg"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{QUICK_COPY_LABELS[key] || key}</span>
            </div>
            <Button
              size="sm"
              variant={copiedKeys.has(key) ? "secondary" : "outline"}
              onClick={() => handleCopy(key)}
              className={cn(
                "ml-2 shrink-0 h-7 px-2 text-xs gap-1",
                copiedKeys.has(key) && "text-green-700 dark:text-green-300"
              )}
            >
              {copiedKeys.has(key) ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedKeys.has(key) ? "Copied" : "Copy"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ name }: { name: string }) {
  const queryClient = useQueryClient()
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    setUploading(true)
    try {
      const res = await fetch(`/api/applications/${name}/upload`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(`Uploaded: ${data.filename}`)
        queryClient.invalidateQueries({ queryKey: ["application", name] })
      } else {
        toast.error(data.error || "Upload failed")
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false) }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    for (const file of Array.from(e.dataTransfer.files)) {
      await uploadFile(file)
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(e.target.files || [])) {
      await uploadFile(file)
    }
    e.target.value = ""
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
        Upload Files
      </h3>
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 bg-background"
        )}
      >
        <input
          type="file"
          className="hidden"
          multiple
          accept=".txt,.pdf,.md,.yml,.yaml,.docx"
          onChange={handleFileInput}
          disabled={uploading}
        />
        <Upload className={cn("w-5 h-5 mb-2", dragOver ? "text-primary" : "text-muted-foreground")} />
        <p className={cn("text-sm font-medium", dragOver ? "text-primary" : "text-muted-foreground")}>
          {uploading ? "Uploading…" : dragOver ? "Drop to upload" : "Drag & drop files, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">.txt, .pdf, .md, .yml, .yaml, .docx</p>
      </label>
    </div>
  )
}

// ─── PDF Preview Dialog ───────────────────────────────────────────────────────

function PdfPreviewDialog({
  name,
  pdf,
  open,
  onOpenChange,
}: {
  name: string
  pdf: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  if (!pdf) return null
  const src = `/api/applications/${name}/pdf?file=${encodeURIComponent(pdf)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-row items-center justify-between px-4 py-3 border-b shrink-0 space-y-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-sm font-mono font-medium">{pdf}</DialogTitle>
            <DialogDescription className="sr-only">PDF preview for {pdf}</DialogDescription>
          </div>
          <a
            href={src}
            download={pdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors mr-6"
          >
            <Download className="w-3 h-3" /> Download
          </a>
        </DialogHeader>
        <iframe
          src={src}
          className="flex-1 w-full rounded-b-xl"
          title={`Preview ${pdf}`}
        />
      </DialogContent>
    </Dialog>
  )
}

// ─── Save Template Dialog ─────────────────────────────────────────────────────

function SaveTemplateDialog({
  position,
  open,
  onOpenChange,
}: {
  position: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [templateName, setTemplateName] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!templateName.trim()) return
    setSaving(true)
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", name: templateName.trim(), template: { position } }),
      })
      toast.success(`Template "${templateName.trim()}" saved`)
      onOpenChange(false)
      setTemplateName("")
    } catch {
      toast.error("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save position <span className="font-medium text-foreground">{position}</span> as a reusable template.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            id="template-name"
            autoFocus
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") onOpenChange(false)
            }}
            placeholder="e.g. Senior Engineer"
          />
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={saving || !templateName.trim()}>
            {saving ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Markdown renderer (no external deps) ─────────────────────────────────────

function renderMarkdown(text: string): string {
  const lines = text.split("\n")
  const output: string[] = []
  let inUl = false

  const closeUl = () => {
    if (inUl) {
      output.push("</ul>")
      inUl = false
    }
  }

  const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

  const processInline = (line: string): string => {
    // Escape HTML entities first to prevent XSS
    line = escapeHtml(line)
    // Bold
    line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic (single star, not double)
    line = line.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    // Inline code
    line = line.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    // URLs (after escaping, & in URLs is now &amp; — match the escaped form)
    line = line.replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2 hover:opacity-80">$1</a>')
    return line
  }

  for (const raw of lines) {
    const line = raw

    // H3 (must be checked before H2 and H1)
    if (/^###\s+/.test(line)) {
      closeUl()
      const heading = processInline(line.replace(/^###\s+/, ""))
      output.push(`<h3 class="text-base font-semibold mt-3 mb-1 text-foreground">${heading}</h3>`)
      continue
    }

    // H2 (must be checked before H1)
    if (/^##\s+/.test(line)) {
      closeUl()
      const heading = processInline(line.replace(/^##\s+/, ""))
      output.push(`<h2 class="text-lg font-semibold mt-4 mb-2 text-foreground">${heading}</h2>`)
      continue
    }

    // H1
    if (/^#\s+/.test(line)) {
      closeUl()
      const heading = processInline(line.replace(/^#\s+/, ""))
      output.push(`<h1 class="text-xl font-bold mt-4 mb-2 text-foreground">${heading}</h1>`)
      continue
    }

    // List item
    if (/^[-*]\s+/.test(line)) {
      if (!inUl) {
        output.push('<ul class="list-disc list-inside space-y-1 my-2 pl-2">')
        inUl = true
      }
      const item = processInline(line.replace(/^[-*]\s+/, ""))
      output.push(`<li class="text-sm">${item}</li>`)
      continue
    }

    // Empty line
    if (line.trim() === "") {
      closeUl()
      output.push('<div class="h-3"></div>')
      continue
    }

    // Regular paragraph line
    closeUl()
    output.push(`<p class="text-sm leading-relaxed">${processInline(line)}</p>`)
  }

  closeUl()
  return output.join("\n")
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ name }: { name: string }) {
  const [content, setContent] = useState("")
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`/api/applications/${name}/notes`)
      .then(r => r.json())
      .then(d => {
        setContent(d.content || "")
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [name])

  const saveNotes = useCallback(async (text: string) => {
    try {
      await fetch(`/api/applications/${name}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      })
      setSavedIndicator(true)
      setTimeout(() => setSavedIndicator(false), 2000)
    } catch {
      toast.error("Failed to save notes")
    }
  }, [name])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNotes(val), 500)
  }

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length
  const charCount = content.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={mode === "edit" ? "default" : "outline"}
            onClick={() => setMode("edit")}
            className="h-7 px-3 text-xs"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant={mode === "preview" ? "default" : "outline"}
            onClick={() => setMode("preview")}
            className="h-7 px-3 text-xs"
          >
            Preview
          </Button>
        </div>
        <span
          className={cn(
            "text-xs text-green-600 dark:text-green-400 flex items-center gap-1 transition-opacity duration-500",
            savedIndicator ? "opacity-100" : "opacity-0"
          )}
        >
          <CheckCircle2 className="w-3 h-3" /> Saved
        </span>
      </div>

      {mode === "edit" ? (
        <>
          <Textarea
            value={content}
            onChange={handleChange}
            disabled={!loaded}
            placeholder={loaded ? "Write your notes here… (auto-saved)" : "Loading…"}
            className="min-h-[420px] resize-y font-mono text-sm leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            {wordCount} {wordCount === 1 ? "word" : "words"} &middot; {charCount} {charCount === 1 ? "char" : "chars"}
          </p>
        </>
      ) : (
        <div
          className={cn(
            "min-h-[420px] rounded-md border border-border bg-background px-4 py-3",
            "text-foreground"
          )}
          dangerouslySetInnerHTML={{ __html: content.trim() === "" ? '<p class="text-sm text-muted-foreground">Nothing to preview yet.</p>' : renderMarkdown(content) }}
        />
      )}
    </div>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({
  milestones,
  position,
}: {
  milestones: Milestone[]
  position: string
}) {
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)

  const events: TimelineEvent[] = [...milestones]
    .sort((a, b) => {
      const da = a.date ? new Date(String(a.date)).getTime() : 0
      const db = b.date ? new Date(String(b.date)).getTime() : 0
      return da - db
    })
    .map(m => ({
      date: String(m.date ?? ""),
      title: String(m.event ?? JSON.stringify(m)),
      type: "milestone" as const,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {milestones.length === 0
            ? "No milestones recorded yet."
            : `${milestones.length} milestone${milestones.length !== 1 ? "s" : ""}`}
        </p>
        {position && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateDialog(true)}
            className="gap-1.5"
          >
            <BookMarked className="w-3.5 h-3.5" />
            Save as Template
          </Button>
        )}
      </div>

      <TimelineView
        events={events}
        emptyMessage="No milestones recorded yet. Use the Log Milestone action to add one."
      />

      <SaveTemplateDialog
        position={position}
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
      />
    </div>
  )
}

// ─── File icon helper ─────────────────────────────────────────────────────────

function fileIcon(filename: string): { icon: React.ElementType; colorClass: string } {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase()
  if (ext === ".pdf") return { icon: FileText, colorClass: "text-red-500" }
  if (ext === ".docx" || ext === ".doc") return { icon: FileText, colorClass: "text-blue-500" }
  if (ext === ".yml" || ext === ".yaml") return { icon: FileCode, colorClass: "text-green-500" }
  if (ext === ".md") return { icon: FileText, colorClass: "text-purple-500" }
  if (ext === ".txt") return { icon: FileText, colorClass: "text-slate-400" }
  return { icon: File, colorClass: "text-muted-foreground" }
}

const FILE_SORT_ORDER: Record<string, number> = { ".yml": 0, ".yaml": 0, ".pdf": 1, ".docx": 2, ".doc": 2 }

function sortFiles(filenames: string[]): string[] {
  return [...filenames].sort((a, b) => {
    const extA = a.slice(a.lastIndexOf(".")).toLowerCase()
    const extB = b.slice(b.lastIndexOf(".")).toLowerCase()
    const orderA = FILE_SORT_ORDER[extA] ?? 99
    const orderB = FILE_SORT_ORDER[extB] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return a.localeCompare(b)
  })
}

// ─── Files Tab ────────────────────────────────────────────────────────────────

function FilesTab({
  name,
  files,
  data,
  onOpenPdf,
  queryClient,
}: {
  name: string
  files: string[]
  data: Record<string, unknown>
  onOpenPdf: (pdf: string) => void
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const [copiedFile, setCopiedFile] = useState<string | null>(null)

  const handleCopyFilename = async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename)
      setCopiedFile(filename)
      setTimeout(() => setCopiedFile(prev => (prev === filename ? null : prev)), 2000)
    } catch {
      toast.error("Clipboard access denied")
    }
  }

  const handleDeleteFile = (filename: string) => {
    toast(`Delete ${filename}?`, {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const res = await fetch(`/api/applications/${name}/files/${encodeURIComponent(filename)}`, {
              method: "DELETE",
            })
            if (!res.ok) {
              const body = await res.json() as { error?: string }
              toast.error(body.error || "Delete failed")
              return
            }
            toast.success(`Deleted: ${filename}`)
            queryClient.invalidateQueries({ queryKey: ["application", name] })
          } catch {
            toast.error("Delete failed")
          }
        },
      },
    })
  }

  const sortedFiles = sortFiles(files)
  const totalCount = files.length

  return (
    <div className="space-y-8">
      {/* File count summary */}
      {totalCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalCount} {totalCount === 1 ? "file" : "files"}
        </p>
      )}

      {/* All files grid (sorted) */}
      {sortedFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
            Files
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {sortedFiles.map(file => {
              const { icon: Icon, colorClass } = fileIcon(file)
              const label = FILE_LABELS[file]
              const isPdf = file.endsWith(".pdf")
              return (
                <div
                  key={file}
                  className="flex items-center justify-between p-3 bg-background border border-border rounded-lg gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={cn("w-4 h-4 shrink-0", colorClass)} />
                    <div className="min-w-0">
                      {label && <p className="text-sm font-medium truncate">{label}</p>}
                      <p className={cn("font-mono truncate", label ? "text-xs text-muted-foreground" : "text-sm")}>{file}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isPdf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenPdf(file)}
                        className="h-7 w-7 p-0"
                        aria-label={`Preview ${file}`}
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyFilename(file)}
                      className="h-7 w-7 p-0"
                      aria-label={`Copy filename ${file}`}
                    >
                      {copiedFile === file
                        ? <Check className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
                        : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                    </Button>
                    <a
                      href={`/api/applications/${name}/pdf?file=${encodeURIComponent(file)}`}
                      download={file}
                    >
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Download ${file}`}>
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFile(file)}
                      className="h-7 w-7 p-0 hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Delete ${file}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Copy */}
      <QuickCopySection data={data} />

      {/* Upload drop zone */}
      <DropZone name={name} />

      {files.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No files generated yet.</p>
          <p className="text-xs mt-1">Run AI actions to generate files, or upload manually above.</p>
        </div>
      )}
    </div>
  )
}

// ─── Page Loading Skeleton ────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-6">
      <Skeleton className="h-5 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex gap-2">
        {[80, 100, 80, 90, 80].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-md" style={{ width: w }} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const params = useParams()
  const name = params.name as string
  const queryClient = useQueryClient()

  const [updatingStage, setUpdatingStage] = useState(false)
  const [currentStage, setCurrentStage] = useState<Stage | null>(null)
  const [previewPdf, setPreviewPdf] = useState<string | null>(null)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)

  const { data: prefsData } = usePreferences(name)
  const aiProvider = prefsData?.ai_provider ?? null

  const { data, isLoading, error } = useQuery({
    queryKey: ["application", name],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${name}`)
      if (!res.ok) throw new Error("Not found")
      return res.json()
    },
  })

  // eslint-disable-next-line react-hooks/purity
  const deadlineThreshold = useMemo(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), [])
  const isDeadlineSoon = data?.meta?.deadline && new Date(data.meta.deadline) <= deadlineThreshold

  const updateStage = async (stage: Stage) => {
    setUpdatingStage(true)
    setCurrentStage(stage)
    try {
      await fetch(`/api/applications/${name}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      })
      toast.success(`Stage updated to ${stage}`)
      queryClient.invalidateQueries({ queryKey: ["application", name] })
      queryClient.invalidateQueries({ queryKey: ["applications"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    } catch {
      toast.error("Failed to update stage")
      setCurrentStage(null)
    } finally {
      setUpdatingStage(false)
    }
  }

  const openPdf = (pdf: string) => {
    setPreviewPdf(pdf)
    setPdfDialogOpen(true)
  }

  if (isLoading) return <PageSkeleton />

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-destructive mb-2">Application not found: {name}</p>
        <Link href="/applications" className="text-primary hover:underline">
          Back to Applications
        </Link>
      </div>
    )
  }

  const meta = data.meta || {}
  const company: string = meta.company || name
  const position: string = meta.position || ""
  const stage: Stage = (currentStage || meta.outcome || "applied") as Stage
  const files: string[] = data.files || []
  const milestones: Milestone[] = data.milestones || []



  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-6">
      {/* Back link */}
      <Link
        href="/applications"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Applications
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{company}</h1>
          {position && (
            <p className="text-muted-foreground text-lg mt-1">{position}</p>
          )}
          <p className="text-muted-foreground/60 text-xs font-mono mt-1">{name}</p>
        </div>
        <Badge variant={stage as Stage} className="capitalize text-sm px-3 py-1 shrink-0 mt-1">
          {stage}
        </Badge>
      </div>

      {/* Deadline warning */}
      {isDeadlineSoon && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Deadline approaching</AlertTitle>
          <AlertDescription>
            This application&apos;s deadline is <strong>{meta.deadline}</strong> &mdash; less than 7 days away.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-10 gap-0.5 w-full sm:w-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <LayoutGrid className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 text-xs sm:text-sm">
            <FolderOpen className="w-3.5 h-3.5" />
            Files
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5 text-xs sm:text-sm">
            <FlaskConical className="w-3.5 h-3.5" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-xs sm:text-sm">
            <StickyNote className="w-3.5 h-3.5" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5 text-xs sm:text-sm">
            <GitCommitHorizontal className="w-3.5 h-3.5" />
            Timeline
            {milestones.length > 0 && (
              <span className="ml-1 bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-medium">
                {milestones.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview ────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Meta cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {meta.created && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Created
                  </p>
                  <p className="text-sm font-semibold">{String(meta.created)}</p>
                </CardContent>
              </Card>
            )}
            {meta.deadline && (
              <Card className={cn(isDeadlineSoon && "border-amber-300 dark:border-amber-700")}>
                <CardContent className="pt-4">
                  <p className={cn(
                    "text-xs mb-1 flex items-center gap-1",
                    isDeadlineSoon ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  )}>
                    <AlertTriangle className="w-3 h-3" /> Deadline
                  </p>
                  <p className={cn(
                    "text-sm font-semibold",
                    isDeadlineSoon && "text-amber-700 dark:text-amber-300"
                  )}>
                    {meta.deadline}
                  </p>
                </CardContent>
              </Card>
            )}
            {meta.response_days && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Response
                  </p>
                  <p className="text-sm font-semibold">{meta.response_days} days</p>
                </CardContent>
              </Card>
            )}
            {data.jobUrl && (
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Job posting
                  </p>
                  <a
                    href={data.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" /> Open link
                  </a>
                </CardContent>
              </Card>
            )}
            {aiProvider && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> AI Provider
                  </p>
                  <Badge variant="outline" className="text-xs capitalize">
                    {aiProvider}
                  </Badge>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Stage selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">
              Application Stage
            </Label>
            <StageSelector stage={stage} updating={updatingStage} onSelect={updateStage} />
          </div>

          <Separator />

          {/* Follow-up reminder */}
          <FollowupReminder name={name} initialDate={meta.followup_date} />

          {/* ATS Score History */}
          <AtsScoreHistory name={name} />

          {/* Job Match Score */}
          <JobMatchCard name={name} />

          {/* Skills Gap */}
          <SkillsGapSection name={name} />
        </TabsContent>

        {/* ── Tab 2: Files ───────────────────────────────────────────────── */}
        <TabsContent value="files" className="space-y-8 mt-4">
          <FilesTab
            name={name}
            files={files}
            data={data as Record<string, unknown>}
            onOpenPdf={openPdf}
            queryClient={queryClient}
          />
        </TabsContent>

        {/* ── Tab 3: Actions ─────────────────────────────────────────────── */}
        <TabsContent value="actions" className="space-y-8 mt-4">
          <AvailableActions appName={name} />
          <Separator />
          <RecentActions appName={name} />
        </TabsContent>

        {/* ── Tab 4: Notes ───────────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-4">
          <NotesTab name={name} />
        </TabsContent>

        {/* ── Tab 5: Timeline ────────────────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab milestones={milestones} position={position} />
        </TabsContent>
      </Tabs>

      {/* PDF Preview Dialog */}
      <PdfPreviewDialog
        name={name}
        pdf={previewPdf}
        open={pdfDialogOpen}
        onOpenChange={open => {
          setPdfDialogOpen(open)
          if (!open) setPreviewPdf(null)
        }}
      />
    </div>
  )
}
