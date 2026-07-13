"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  Search, LayoutDashboard, FileText, BarChart3, Settings,
  PlusCircle, Columns, History, Zap, Calendar, Layers,
} from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { ACTION_REGISTRY, CATEGORY_LABELS } from "@/lib/action-registry"

interface PaletteItem {
  label: string
  href: string
  section: string
  icon: React.ElementType
  description?: string
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  workflow: Zap,
  cv: FileText,
  intelligence: Search,
  interview: Calendar,
  salary: BarChart3,
  outreach: Search,
  linkedin: Layers,
  reports: LayoutDashboard,
}

const ITEMS: PaletteItem[] = [
  // Pages
  { label: "Dashboard", href: "/", section: "Pages", icon: LayoutDashboard, description: "Home dashboard" },
  { label: "Applications", href: "/applications", section: "Pages", icon: FileText, description: "All applications" },
  { label: "Board", href: "/applications/board", section: "Pages", icon: Columns, description: "Kanban board" },
  { label: "New Application", href: "/applications/new", section: "Pages", icon: PlusCircle, description: "Create application" },
  { label: "Statistics", href: "/stats", section: "Pages", icon: BarChart3, description: "Charts and stats" },
  { label: "Search", href: "/search", section: "Pages", icon: Search, description: "Full-text search" },
  { label: "Calendar", href: "/calendar", section: "Pages", icon: Calendar, description: "Deadline calendar" },
  { label: "History", href: "/history", section: "Pages", icon: History, description: "Action history" },
  { label: "All Actions", href: "/actions", section: "Pages", icon: Zap, description: "Browse all actions" },
  { label: "Settings", href: "/settings", section: "Pages", icon: Settings, description: "App settings" },
  // Actions from registry
  ...ACTION_REGISTRY.map(action => ({
    label: action.title,
    href: `/actions/${action.slug}`,
    section: CATEGORY_LABELS[action.category],
    icon: CATEGORY_ICONS[action.category] || Zap,
    description: action.description,
  })),
]

const SECTIONS = Array.from(new Set(ITEMS.map(i => i.section)))

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      triggerRef.current = document.activeElement as HTMLElement
    } else {
      // Return focus to the element that opened the palette
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
    setOpen(next)
  }, [])

  const navigate = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
        <Command
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-input]]:w-full [&_[cmdk-input]]:border-0 [&_[cmdk-input]]:bg-transparent [&_[cmdk-input]]:text-sm [&_[cmdk-input]]:outline-none [&_[cmdk-input]]:placeholder:text-muted-foreground [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Search pages and actions..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-1">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            {SECTIONS.map(section => (
              <Command.Group key={section} heading={section}>
                {ITEMS.filter(i => i.section === section).map(item => {
                  const Icon = item.icon
                  return (
                    <Command.Item
                      key={item.href}
                      value={`${item.label} ${item.description ?? ""} ${section}`}
                      onSelect={() => navigate(item.href)}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none",
                        "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                      )}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        )}
                      </div>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            ))}
          </Command.List>
          <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span><kbd className="font-mono rounded bg-muted px-1.5 py-0.5 text-xs">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono rounded bg-muted px-1.5 py-0.5 text-xs">↵</kbd> open</span>
            <span><kbd className="font-mono rounded bg-muted px-1.5 py-0.5 text-xs">esc</kbd> close</span>
          </div>
        </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
