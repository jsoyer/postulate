"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  FileText, TrendingUp, Users, BarChart3,
  Plus, Zap, Target, BookOpen, Search, CheckCircle,
  Calendar, Clock, Bell, HeartPulse,
} from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { RssJobDiscovery } from "@/components/dashboard/RssJobDiscovery"

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "applied" | "interview" | "offer" | "rejected" | "ghosted"

interface Application {
  name: string
  company: string
  position: string
  stage: Stage
  deadline?: string
  followup_date?: string
  created?: string
}

interface DashboardStats {
  total: number
  byStage: Partial<Record<Stage, number>>
  responseRate: number
  interviewRate: number
}

interface DashboardData {
  stats: DashboardStats
  applications: Application[]
  cvData: { name?: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER: Stage[] = ["applied", "interview", "offer", "rejected", "ghosted"]

const WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

const STAGE_PROGRESS_COLORS: Record<Stage, string> = {
  applied:   "bg-blue-500",
  interview: "bg-yellow-500",
  offer:     "bg-green-500",
  rejected:  "bg-red-500",
  ghosted:   "bg-slate-400",
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  iconBg: string
}

function KpiCard({ title, value, icon, iconBg }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-medium text-muted-foreground leading-none mb-2">
              {title}
            </p>
            <p className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          </div>
          <div className={cn("p-2.5 rounded-lg shrink-0", iconBg)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CV Health KPI Card ───────────────────────────────────────────────────────

function CvHealthKpiCard() {
  const iconBg = "bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500"

  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm font-medium text-muted-foreground leading-none mb-2">
              CV Health
            </p>
            <p className="text-2xl md:text-3xl font-bold tracking-tight text-muted-foreground">
              —
            </p>
            <Link
              href="/actions/cv-health"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1.5 inline-block"
            >
              Run audit &rarr;
            </Link>
          </div>
          <div className={cn("p-2.5 rounded-lg shrink-0", iconBg)}>
            <HeartPulse className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Deadline Alert ───────────────────────────────────────────────────────────

function DeadlineAlert({ applications }: { applications: Application[] }) {
  const now = new Date()
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const upcoming = applications.filter(a => {
    if (!a.deadline) return false
    const d = new Date(a.deadline)
    return d >= now && d <= in7
  })
  if (upcoming.length === 0) return null
  return (
    <Alert variant="warning">
      <Clock className="h-4 w-4" />
      <AlertTitle>Upcoming deadlines</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-1">
          {upcoming.map(a => (
            <li key={a.name}>
              <Link
                href={`/applications/${a.name}`}
                className="font-medium hover:underline"
              >
                {a.company}
              </Link>
              {" — "}{a.position}
              <span className="font-mono ml-2 text-xs opacity-80">{a.deadline}</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

// ─── Follow-up Alert ──────────────────────────────────────────────────────────

function FollowupAlert({ applications }: { applications: Application[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = applications.filter(a => {
    if (!a.followup_date) return false
    if (!["applied", "ghosted"].includes(a.stage)) return false
    return new Date(a.followup_date) < today
  })
  if (overdue.length === 0) return null
  return (
    <Alert variant="destructive">
      <Bell className="h-4 w-4" />
      <AlertTitle>Overdue follow-ups</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-1">
          {overdue.map(a => (
            <li key={a.name}>
              <Link
                href={`/applications/${a.name}`}
                className="font-medium hover:underline"
              >
                {a.company}
              </Link>
              {" — "}{a.position}
              <span className="font-mono ml-2 text-xs opacity-80">{a.followup_date}</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard")
      return res.json()
    },
  })

  const [aiProviders, setAiProviders] = useState<Record<string, string>>({})

  useEffect(() => {
    const apps = data?.applications ?? []
    if (apps.length === 0) return
    Promise.all(
      apps.slice(0, 5).map(async (app: { name: string }) => {
        try {
          const res = await fetch(`/api/applications/${encodeURIComponent(app.name)}/preferences`)
          const d = await res.json()
          if (d.ai_provider) return { name: app.name, provider: d.ai_provider }
          return null
        } catch {
          return null
        }
      })
    ).then(results => {
      const map: Record<string, string> = {}
      results.forEach(r => { if (r) map[r.name] = r.provider })
      setAiProviders(map)
    })
  }, [data])

  if (isLoading) return <DashboardSkeleton />

  const stats = data?.stats ?? { total: 0, byStage: {}, responseRate: 0, interviewRate: 0 }
  const applications = data?.applications ?? []
  const cvData = data?.cvData ?? {}

  const inProgress = (stats.byStage.applied ?? 0) + (stats.byStage.interview ?? 0)

  const quickActions = [
    { href: "/applications/new",  icon: Plus,      label: "New Application", iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
    { href: "/actions/tailor",    icon: Zap,        label: "AI Tailor",        iconBg: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400" },
    { href: "/actions/score",     icon: Target,     label: "ATS Score",        iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400" },
    { href: "/actions/prep",      icon: BookOpen,   label: "Interview Prep",   iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" },
    { href: "/actions/discover",  icon: Search,     label: "Discover Jobs",    iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400" },
    { href: "/stats",             icon: CheckCircle,label: "View Stats",       iconBg: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" },
  ]

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          {cvData.name ? `Welcome back, ${cvData.name}` : "Job Application Tracker"}
        </p>
      </div>

      {/* Alerts */}
      <DeadlineAlert applications={applications} />
      <FollowupAlert applications={applications} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Applications"
          value={stats.total}
          icon={<FileText className="w-5 h-5" />}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        />
        <KpiCard
          title="Response Rate"
          value={`${stats.responseRate}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
        />
        <KpiCard
          title="Interview Rate"
          value={`${stats.interviewRate}%`}
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
        />
        <KpiCard
          title="In Progress"
          value={inProgress}
          icon={<BarChart3 className="w-5 h-5" />}
          iconBg="bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
        />
        <CvHealthKpiCard />
      </div>

      {/* Stage Breakdown + Recent Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Applications by Stage */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Applications by Stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STAGE_ORDER.filter(s => (stats.byStage[s] ?? 0) > 0).length > 0 ? (
              STAGE_ORDER.map(stage => {
                const count = stats.byStage[stage] ?? 0
                if (count === 0) return null
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <Badge variant={stage as BadgeProps["variant"]} className="capitalize w-full justify-center">
                        {stage}
                      </Badge>
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", STAGE_PROGRESS_COLORS[stage])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground w-6 text-right shrink-0">
                      {count}
                    </span>
                    <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                      {pct}%
                    </span>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground py-2">No applications yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Applications</CardTitle>
              <Link
                href="/applications"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {applications.length > 0 ? (
              applications.slice(0, 5).map((app) => (
                <Link
                  key={app.name}
                  href={`/applications/${app.name}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{app.company}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{app.position}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {aiProviders[app.name] && (
                      <Badge variant="outline" className="text-xs capitalize px-1.5 py-0">
                        {aiProviders[app.name]}
                      </Badge>
                    )}
                    <Badge variant={app.stage as BadgeProps["variant"]} className="capitalize">
                      {app.stage}
                    </Badge>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-2">No applications yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Digest — merged from /digest */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pipeline Digest</CardTitle>
            <Link
              href="/actions/digest"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Run full digest &rarr;
            </Link>
          </div>
          <CardDescription>Your job search summary for this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* New This Week */}
            <div className="p-4 rounded-lg border bg-accent/50">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold">New This Week</span>
              </div>
              {applications.filter(a => {
                const created = a.created ? new Date(String(a.created)) : null
                return created && created >= WEEK_AGO
              }).length === 0 ? (
                <p className="text-sm text-muted-foreground">No new applications</p>
              ) : (
                <div className="space-y-1.5">
                  {applications
                    .filter(a => {
                      const created = a.created ? new Date(String(a.created)) : null
                      return created && created >= WEEK_AGO
                    })
                    .slice(0, 3)
                    .map(a => (
                      <Link
                        key={a.name}
                        href={`/applications/${a.name}`}
                        className="flex items-center justify-between text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                      >
                        <span className="font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {a.company}
                        </span>
                        <Badge variant={a.stage as BadgeProps["variant"]} className="ml-2 capitalize text-xs">
                          {a.stage}
                        </Badge>
                      </Link>
                    ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {applications.filter(a => {
                  const created = a.created ? new Date(String(a.created)) : null
                  return created && created >= WEEK_AGO
                }).length} this week
              </p>
            </div>

            {/* Upcoming Deadlines */}
            <div className="p-4 rounded-lg border bg-accent/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold">Upcoming Deadlines</span>
              </div>
              {(() => {
                const now = new Date()
                const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                const upcoming = applications.filter(a => {
                  if (!a.deadline) return false
                  const d = new Date(a.deadline)
                  return d >= now && d <= in7
                })
                return upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                ) : (
                  <div className="space-y-1.5">
                    {upcoming.slice(0, 3).map(a => (
                      <Link
                        key={a.name}
                        href={`/applications/${a.name}`}
                        className="flex items-center justify-between text-sm group"
                      >
                        <span className="font-medium truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {a.company}
                        </span>
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-mono shrink-0">
                          {(() => {
                            try {
                              return new Date(a.deadline!).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                            } catch { return a.deadline }
                          })()}
                        </span>
                      </Link>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Overdue Follow-ups */}
            <div className="p-4 rounded-lg border bg-accent/50">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold">Overdue Follow-ups</span>
              </div>
              {(() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const overdue = applications.filter(a => {
                  if (!a.followup_date) return false
                  if (!["applied", "ghosted"].includes(a.stage)) return false
                  return new Date(a.followup_date) < today
                })
                return overdue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All caught up</p>
                ) : (
                  <div className="space-y-1.5">
                    {overdue.slice(0, 3).map(a => (
                      <Link
                        key={a.name}
                        href={`/applications/${a.name}`}
                        className="flex items-center justify-between text-sm group"
                      >
                        <span className="font-medium truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {a.company}
                        </span>
                        <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-mono shrink-0">
                          {(() => {
                            try {
                              return new Date(a.followup_date!).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                            } catch { return a.followup_date }
                          })()}
                        </span>
                      </Link>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Board Preview — merged from Apply Board */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pipeline Board</CardTitle>
            <Link
              href="/applications/board"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Open full board &rarr;
            </Link>
          </div>
          <CardDescription>Quick view of applications by stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {STAGE_ORDER.map(stage => {
              const count = stats.byStage[stage] ?? 0
              const stageApps = applications.filter(a => a.stage === stage).slice(0, 2)
              return (
                <div key={stage} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={stage as BadgeProps["variant"]} className="capitalize text-xs">
                      {stage}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">{count}</span>
                  </div>
                  <div className="space-y-1.5">
                    {stageApps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      stageApps.map(a => (
                        <Link
                          key={a.name}
                          href={`/applications/${a.name}`}
                          className="block text-xs font-medium truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {a.company}
                        </Link>
                      ))
                    )}
                    {count > 2 && (
                      <p className="text-xs text-muted-foreground">+{count - 2} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* RSS Job Discovery */}
      <RssJobDiscovery />

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map(action => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-2.5 p-4 rounded-lg border border-border hover:bg-accent hover:border-accent transition-colors text-center group"
              >
                <div className={cn("p-2 rounded-lg transition-colors", action.iconBg)}>
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = "/api/export/ical" }}
          >
            <Calendar className="w-4 h-4" />
            Export to Calendar (.ics)
          </Button>
        </CardFooter>
      </Card>

    </div>
  )
}
