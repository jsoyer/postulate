"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/ThemeProvider"
import { useSelectedApp } from "@/components/SelectedAppContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  Calendar,
  Search,
  Clock,
  Zap,
  Columns,
  Target,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react"

type NavItem = { href: string; label: string; icon: React.ElementType }

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/applications/board", label: "Board", icon: Columns },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/history", label: "History", icon: Clock },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/settings", label: "Settings", icon: Settings },
]

function getInitials(company: string): string {
  return company
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

interface NavLinkProps {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  const link = (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const { selectedApp, setSelectedApp } = useSelectedApp()

  const { data: appsData } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications/list")
      return res.json()
    },
    staleTime: 30000,
  })
  const apps: Array<{ name: string; company: string; position: string }> =
    appsData?.applications || []

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return localStorage.getItem("sidebar-collapsed") === "true"
    } catch {
      return false
    }
  })

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("sidebar-collapsed", String(next))
      } catch {}
      return next
    })
  }

  const themeButton = (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground transition-colors duration-150 w-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "justify-center" : ""
      )}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 shrink-0" />
      ) : (
        <Moon className="w-4 h-4 shrink-0" />
      )}
      {!collapsed && (
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      )}
    </button>
  )

  return (
    <aside
      role="navigation"
      aria-label="Sidebar navigation"
      className={cn(
        "h-screen bg-sidebar text-sidebar-foreground hidden md:flex flex-col border-r border-white/10 transition-all duration-200 shrink-0",
        collapsed ? "w-[60px]" : "w-72"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center border-b border-white/10 shrink-0",
          collapsed ? "justify-center p-3" : "justify-between px-4 py-3"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary shrink-0">
              <Target className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight tracking-tight">CV Manager</p>
              <p className="text-[10px] text-sidebar-foreground/50 leading-tight">
                Job Application Tracker
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary">
            <Target className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-white/10 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                collapsed ? "mt-2" : ""
              )}
            >
              {collapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* App selector */}
      {!collapsed ? (
        <div className="px-3 py-2.5 border-b border-white/10 shrink-0">
          <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-1.5">
            Active Application
          </p>
          <select
            aria-label="Active application selector"
            value={selectedApp?.name ?? ""}
            onChange={(e) => {
              const app = apps.find((a) => a.name === e.target.value)
              setSelectedApp(
                app
                  ? { name: app.name, company: app.company, position: app.position }
                  : null
              )
            }}
            className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white/5 border border-white/10 text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer transition-colors hover:bg-white/10"
          >
            <option value="">— None selected —</option>
            {apps.map((app) => (
              <option key={app.name} value={app.name}>
                {app.company}
                {app.position ? ` · ${app.position.slice(0, 22)}` : ""}
              </option>
            ))}
          </select>
          {selectedApp && (
            <p className="text-[10px] text-sidebar-foreground/40 font-mono mt-1 truncate">
              {selectedApp.name}
            </p>
          )}
        </div>
      ) : (
        <div className="flex justify-center py-2.5 border-b border-white/10 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold shrink-0 cursor-default",
                  selectedApp
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-sidebar-foreground/40"
                )}
              >
                {selectedApp ? getInitials(selectedApp.company) : "—"}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {selectedApp
                ? `${selectedApp.company} — ${selectedApp.name}`
                : "No application selected"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/")
            return (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive}
                collapsed={collapsed}
              />
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer — theme toggle */}
      <div className="p-2 border-t border-white/10 shrink-0">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{themeButton}</TooltipTrigger>
            <TooltipContent side="right">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>
        ) : (
          themeButton
        )}
      </div>
    </aside>
  )
}
