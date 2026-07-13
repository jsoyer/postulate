"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, AlertTriangle, Zap, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useJobMatch, useRunJobMatch } from "@/lib/api-hooks"
import type { JobMatchResponse } from "@/lib/api-types"

const AI_PROVIDERS = [
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "mistral", label: "Mistral" },
  { value: "ollama", label: "Ollama" },
]

const CATEGORIES: { key: keyof JobMatchResponse["breakdown"]; label: string }[] = [
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "location", label: "Location" },
  { key: "salary", label: "Salary" },
  { key: "culture", label: "Culture" },
]

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-green-100 dark:bg-green-900/50"
  if (score >= 50) return "bg-amber-100 dark:bg-amber-900/50"
  return "bg-red-100 dark:bg-red-900/50"
}

function recommendationBadge(recommendation: JobMatchResponse["recommendation"]) {
  const config = {
    proceed: { icon: CheckCircle2, bg: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300", label: "Proceed" },
    caution: { icon: AlertCircle, bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", label: "Caution" },
    skip: { icon: XCircle, bg: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300", label: "Skip" },
  }
  const { icon: Icon, bg, label } = config[recommendation]
  return (
    <Badge className={cn("gap-1 text-xs", bg)}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  )
}

function CircularProgress({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444"

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className={cn("absolute text-lg font-bold tabular-nums", scoreColor(score))}>
        {score}
      </span>
    </div>
  )
}

interface JobMatchCardProps {
  name: string
}

export function JobMatchCard({ name }: JobMatchCardProps) {
  const { data, isLoading: isLoadingMatch } = useJobMatch(name)
  const runMatch = useRunJobMatch()
  const [aiProvider, setAiProvider] = useState("gemini")
  const [expanded, setExpanded] = useState(false)

  const isRunning = runMatch.isPending
  const hasResult = data !== null && data !== undefined

  const handleRun = () => {
    runMatch.mutate({ name, ai: aiProvider })
  }

  if (isLoadingMatch) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Job Match Score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Job Match Score
          </CardTitle>
          {hasResult && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-6 w-6 p-0"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasResult && !isRunning && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={aiProvider} onValueChange={setAiProvider}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleRun} className="h-8 gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5" />
                Run Match
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Select an AI provider and run match to analyze fit.
            </p>
          </div>
        )}

        {isRunning && (
          <div className="flex flex-col items-center gap-3 py-4">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing match...</p>
          </div>
        )}

        {hasResult && data && (
          <>
            <div className="flex items-center gap-4">
              <CircularProgress score={data.overall_score} />
              <div className="flex-1 space-y-1">
                {recommendationBadge(data.recommendation)}
                <p className="text-xs text-muted-foreground line-clamp-2">{data.reasoning}</p>
              </div>
            </div>

            {data.red_flags.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Red Flags
                </p>
                <ul className="space-y-0.5">
                  {data.red_flags.map((flag, i) => (
                    <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                      <span className="mt-0.5 w-1 h-1 rounded-full bg-red-500 shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {expanded && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Breakdown
                </p>
                {CATEGORIES.map(({ key, label }) => {
                  const cat = data.breakdown[key]
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{label}</span>
                        <span className={cn("text-xs font-bold tabular-nums", scoreColor(cat.score))}>
                          {cat.score}
                        </span>
                      </div>
                      <div className={cn("h-1.5 rounded-full", scoreBg(cat.score))}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${cat.score}%`,
                            backgroundColor: cat.score >= 70 ? "#22c55e" : cat.score >= 50 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                      {"notes" in cat && cat.notes && (
                        <p className="text-xs text-muted-foreground">{cat.notes}</p>
                      )}
                      {"matched" in cat && (
                        <div className="space-y-1">
                          {cat.matched.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {cat.matched.slice(0, 5).map(s => (
                                <Badge key={s} variant="outline" className="text-[10px] bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                                  {s}
                                </Badge>
                              ))}
                              {cat.matched.length > 5 && (
                                <span className="text-[10px] text-muted-foreground">+{cat.matched.length - 5} more</span>
                              )}
                            </div>
                          )}
                          {cat.missing.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {cat.missing.slice(0, 5).map(s => (
                                <Badge key={s} variant="outline" className="text-[10px] bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
                                  {s}
                                </Badge>
                              ))}
                              {cat.missing.length > 5 && (
                                <span className="text-[10px] text-muted-foreground">+{cat.missing.length - 5} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="flex items-center gap-2 pt-2">
                  <Select value={aiProvider} onValueChange={setAiProvider}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value} className="text-xs">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={handleRun} disabled={isRunning} className="h-7 gap-1.5 text-xs">
                    <RefreshCw className={cn("w-3 h-3", isRunning && "animate-spin")} />
                    Re-run
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
