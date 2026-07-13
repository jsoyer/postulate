"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation"
import {
  LayoutDashboard,
  FileText,
  Columns,
  Search,
  Settings,
} from "lucide-react"

const items = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/applications", icon: FileText, label: "Applications" },
  { href: "/applications/board", icon: Columns, label: "Board" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const currentIndex = items.findIndex(({ href }) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/")
  )

  useSwipeNavigation({
    onSwipeLeft: () => {
      const next = currentIndex + 1
      if (next < items.length) {
        router.push(items[next].href)
      }
    },
    onSwipeRight: () => {
      const prev = currentIndex - 1
      if (prev >= 0) {
        router.push(items[prev].href)
      }
    },
  })

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-sm border-t border-border flex items-stretch min-h-[64px] pb-[env(safe-area-inset-bottom)]"
    >
      {items.map(({ href, icon: Icon, label }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/")

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 min-w-0"
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-200 w-12 h-12",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
            </span>
            <span
              className={cn(
                "text-[10px] font-medium leading-none tracking-tight truncate transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
