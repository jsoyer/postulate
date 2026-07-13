"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import {
  BarChart3, TrendingUp, Users, CheckCircle,
  Mail, PhoneCall, Award, Ghost, Calendar, Zap,
} from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell,
  AreaChart, Area,
} from "recharts"

import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "applied" | "interview" | "offer" | "rejected" | "ghosted"

interface StatsData {
  total: number
  byStage: Partial<Record<Stage, number>>
  responseRate: number
  interviewRate: number
}

interface ApplicationItem {
  name: string
  created?: string | number
  stage?: Stage
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getISOWeekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function Heatmap({ applications }: { applications: ApplicationItem[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const countByDate: Record<string, number> = {}
  for (const app of applications) {
    const created = app.created ? String(app.created) : null
    if (!created) continue
    const d = new Date(created)
    if (isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10)
    countByDate[key] = (countByDate[key] || 0) + 1
  }

  const startMonday = getMonday(new Date(today.getTime() - 51 * 7 * 24 * 60 * 60 * 1000))

  const weeks: Date[][] = []
  for (let w = 0; w < 52; w++) {
    const days: Date[] = []
    for (let d = 0; d < 7; d++) {
      days.push(new Date(startMonday.getTime() + (w * 7 + d) * 24 * 60 * 60 * 1000))
    }
    weeks.push(days)
  }

  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((days, i) => {
    const month = days[0].getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      monthLabels.push({
        label: days[0].toLocaleDateString("en-US", { month: "short" }),
        col: i,
      })
    }
  })

  function cellColor(count: number): string {
    if (count === 0) return "bg-muted"
    if (count === 1) return "bg-green-200 dark:bg-green-900"
    if (count === 2) return "bg-green-400 dark:bg-green-700"
    return "bg-green-600 dark:bg-green-500"
  }

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Activity Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: "700px" }}>
            {/* Month labels */}
            <div className="flex mb-1 ml-8">
              {weeks.map((_, i) => {
                const label = monthLabels.find(m => m.col === i)
                return (
                  <div
                    key={i}
                    className="w-3.5 shrink-0 text-xs text-muted-foreground"
                    style={{ marginRight: "1px" }}
                  >
                    {label ? label.label : ""}
                  </div>
                )
              })}
            </div>
            {/* Grid */}
            <div className="flex gap-0">
              {/* Day labels */}
              <div className="flex flex-col mr-1">
                {DAY_LABELS.map((day, i) => (
                  <div
                    key={day}
                    className="h-3.5 text-muted-foreground text-right pr-1"
                    style={{ marginBottom: "1px", lineHeight: "14px", fontSize: "10px" }}
                  >
                    {i % 2 === 0 ? day.slice(0, 2) : ""}
                  </div>
                ))}
              </div>
              {/* Cells */}
              {weeks.map((days, wi) => (
                <div key={wi} className="flex flex-col" style={{ marginRight: "1px" }}>
                  {days.map((day, di) => {
                    const key = day.toISOString().slice(0, 10)
                    const count = countByDate[key] || 0
                    const isFuture = day > today
                    return (
                      <div
                        key={di}
                        title={`${key}: ${count} application${count !== 1 ? "s" : ""}`}
                        className={cn(
                          "w-3.5 h-3.5 rounded-sm transition-colors",
                          isFuture ? "opacity-0" : cellColor(count),
                        )}
                        style={{ marginBottom: "1px" }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1.5 mt-2 ml-8 text-xs text-muted-foreground">
              <span>Less</span>
              {[0, 1, 2, 3].map(n => (
                <div key={n} className={cn("w-3.5 h-3.5 rounded-sm", cellColor(n))} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Cumulative Chart ─────────────────────────────────────────────────────────

function CumulativeChart({ applications }: { applications: ApplicationItem[] }) {
  const weekCounts: Record<string, number> = {}
  for (const app of applications) {
    const created = app.created ? String(app.created) : null
    if (!created) continue
    const d = new Date(created)
    if (isNaN(d.getTime())) continue
    const key = getISOWeekKey(d)
    weekCounts[key] = (weekCounts[key] || 0) + 1
  }

  const sortedWeeks = Object.keys(weekCounts).sort()
  if (sortedWeeks.length === 0) return null

  const data = sortedWeeks.reduce<Array<{ week: string; label: string; total: number; new: number }>>(
    (acc, week) => {
      const prevTotal = acc.length > 0 ? acc[acc.length - 1].total : 0
      const [year, wStr] = week.split("-W")
      const weekNum = parseInt(wStr, 10)
      const jan1 = new Date(parseInt(year, 10), 0, 1)
      const dayOfWeek = jan1.getDay() || 7
      const weekDate = new Date(jan1)
      weekDate.setDate(jan1.getDate() + (weekNum - 1) * 7 - (dayOfWeek - 1))
      return [
        ...acc,
        {
          week,
          label: weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          total: prevTotal + weekCounts[week],
          new: weekCounts[week],
        },
      ]
    },
    [],
  )

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Cumulative Applications Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
              itemStyle={{ color: "#60a5fa" }}
              labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Total"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Stage Bar Chart ──────────────────────────────────────────────────────────

function StageBarChart({ byStage }: { byStage: Partial<Record<Stage, number>> }) {
  const STAGE_COLORS: Record<string, string> = {
    applied:   "#3b82f6",
    interview: "#eab308",
    offer:     "#22c55e",
    rejected:  "#ef4444",
    ghosted:   "#94a3b8",
  }

  const data = Object.entries(byStage).map(([stage, count]) => ({
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    count,
    fill: STAGE_COLORS[stage] ?? "#94a3b8",
  }))

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Applications by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
              strokeOpacity={0.4}
            />
            <XAxis
              dataKey="stage"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
              cursor={{ fill: "rgba(148,163,184,0.1)" }}
            />
            <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function WeeklyBarChart({ applications }: { applications: ApplicationItem[] }) {
  const weekCounts: Record<string, number> = {}
  for (const app of applications) {
    const created = app.created ? String(app.created) : null
    if (!created) continue
    const d = new Date(created)
    if (isNaN(d.getTime())) continue
    const key = getISOWeekKey(d)
    weekCounts[key] = (weekCounts[key] || 0) + 1
  }

  const sortedWeeks = Object.keys(weekCounts).sort().slice(-12)
  if (sortedWeeks.length === 0) return null

  const data = sortedWeeks.map(week => {
    const [year, wStr] = week.split("-W")
    const weekNum = parseInt(wStr, 10)
    const jan1 = new Date(parseInt(year, 10), 0, 1)
    const dayOfWeek = jan1.getDay() || 7
    const weekDate = new Date(jan1)
    weekDate.setDate(jan1.getDate() + (weekNum - 1) * 7 - (dayOfWeek - 1))
    return {
      week,
      label: weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: weekCounts[week],
    }
  })

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">New Applications per Week</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
              strokeOpacity={0.4}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
              itemStyle={{ color: "#60a5fa" }}
              labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
              cursor={{ fill: "rgba(148,163,184,0.1)" }}
            />
            <Bar dataKey="count" name="New" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Pipeline Over Time ───────────────────────────────────────────────────────

const STAGE_AREA_CONFIG: Array<{ key: Stage; color: string }> = [
  { key: "applied",   color: "#3b82f6" },
  { key: "interview", color: "#f59e0b" },
  { key: "offer",     color: "#22c55e" },
  { key: "rejected",  color: "#ef4444" },
  { key: "ghosted",   color: "#94a3b8" },
]

function PipelineOverTime({ applications }: { applications: ApplicationItem[] }) {
  const monthStage: Record<string, Partial<Record<Stage, number>>> = {}

  for (const app of applications) {
    const created = app.created ? String(app.created) : null
    if (!created) continue
    const d = new Date(created)
    if (isNaN(d.getTime())) continue
    const month = d.toISOString().slice(0, 7)
    const stage = app.stage ?? "applied"
    if (!monthStage[month]) monthStage[month] = {}
    monthStage[month][stage] = (monthStage[month][stage] ?? 0) + 1
  }

  const sortedMonths = Object.keys(monthStage).sort()
  if (sortedMonths.length === 0) return null

  const data = sortedMonths.map(month => {
    const [year, m] = month.split("-")
    const label = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1)
      .toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    return {
      month,
      label,
      ...STAGE_AREA_CONFIG.reduce<Partial<Record<Stage, number>>>((acc, { key }) => {
        acc[key] = monthStage[month][key] ?? 0
        return acc
      }, {}),
    }
  })

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Pipeline Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <defs>
              {STAGE_AREA_CONFIG.map(({ key, color }) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
              strokeOpacity={0.4}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
            />
            {STAGE_AREA_CONFIG.map(({ key, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={key.charAt(0).toUpperCase() + key.slice(1)}
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#grad-${key})`}
                stackId="1"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Velocity Helper ──────────────────────────────────────────────────────────

function computeVelocity(applications: ApplicationItem[]): string {
  const now = new Date()
  const cutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const recent = applications.filter(app => {
    const created = app.created ? String(app.created) : null
    if (!created) return false
    const d = new Date(created)
    return !isNaN(d.getTime()) && d >= cutoff
  })
  const velocity = recent.length / 4
  return Number.isInteger(velocity) ? String(velocity) : velocity.toFixed(1)
}

// ─── Conversion Rate Row ──────────────────────────────────────────────────────

function ConvRate({ label, num, den }: { label: string; num: number; den: number }) {
  const rate = den > 0 ? Math.round((num / den) * 100) : 0
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{rate}%</span>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-44 rounded-md" />
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
          <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
          <CardContent><Skeleton className="h-[200px] w-full rounded" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-[180px] w-full rounded" /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
        <CardContent><Skeleton className="h-[120px] w-full rounded" /></CardContent>
      </Card>
    </div>
  )
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

// ─── Stage Details Config ─────────────────────────────────────────────────────

const STAGE_DETAILS: Array<{
  key: Stage
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  barColor: string
}> = [
  { key: "applied",   label: "Applied",   icon: Mail,      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",         barColor: "#3b82f6" },
  { key: "interview", label: "Interview", icon: PhoneCall, iconBg: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",  barColor: "#eab308" },
  { key: "offer",     label: "Offer",     icon: Award,     iconBg: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",      barColor: "#22c55e" },
  { key: "rejected",  label: "Rejected",  icon: BarChart3, iconBg: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",              barColor: "#ef4444" },
  { key: "ghosted",   label: "Ghosted",   icon: Ghost,     iconBg: "bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400",      barColor: "#94a3b8" },
]

// ─── Summary Row ──────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats")
      return res.json()
    },
    placeholderData: keepPreviousData,
  })

  const { data: appsData } = useQuery<{ applications: ApplicationItem[] }>({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications/list")
      return res.json()
    },
    placeholderData: keepPreviousData,
  })

  if (statsLoading) return <StatsSkeleton />

  const stats = statsData ?? { total: 0, byStage: {}, responseRate: 0, interviewRate: 0 }
  const applications = appsData?.applications ?? []

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Statistics</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Track your job search progress
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { window.location.href = "/api/export/ical" }}
          className="shrink-0"
        >
          <Calendar className="w-4 h-4" />
          Export to Calendar (.ics)
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Applications"
          value={stats.total}
          icon={<BarChart3 className="w-5 h-5" />}
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
          title="Offers"
          value={stats.byStage.offer ?? 0}
          icon={<CheckCircle className="w-5 h-5" />}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
        />
        <KpiCard
          title="Velocity (4 wks)"
          value={`${computeVelocity(applications)}/wk`}
          icon={<Zap className="w-5 h-5" />}
          iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CumulativeChart applications={applications} />
        <StageBarChart byStage={stats.byStage} />
        <WeeklyBarChart applications={applications} />
      </div>

      {/* Pipeline Over Time */}
      <PipelineOverTime applications={applications} />

      {/* Heatmap */}
      <Heatmap applications={applications} />

      {/* Funnel Overview */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Funnel Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {STAGE_DETAILS.map(stage => {
            const count = stats.byStage[stage.key] ?? 0
            const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
            return (
              <div key={stage.key} className="flex items-center gap-4">
                <div className={cn("p-2 rounded-lg shrink-0", stage.iconBg)}>
                  <stage.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm font-medium text-foreground">{stage.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={stage.key as BadgeProps["variant"]} className="tabular-nums">
                        {count}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${percentage}%`, backgroundColor: stage.barColor }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Conversion Rates + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Conversion Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              <ConvRate
                label="Applied to Interview"
                num={stats.byStage.interview ?? 0}
                den={stats.total}
              />
              <ConvRate
                label="Interview to Offer"
                num={stats.byStage.offer ?? 0}
                den={stats.byStage.interview ?? 0}
              />
              <ConvRate
                label="Rejection Rate"
                num={stats.byStage.rejected ?? 0}
                den={stats.total}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              <SummaryRow label="Total applications" value={stats.total} />
              <SummaryRow label="In interview stage"  value={stats.byStage.interview ?? 0} />
              <SummaryRow label="Offers received"     value={stats.byStage.offer ?? 0} />
              <SummaryRow label="Rejections"          value={stats.byStage.rejected ?? 0} />
              <SummaryRow label="Ghosted"             value={stats.byStage.ghosted ?? 0} />
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
