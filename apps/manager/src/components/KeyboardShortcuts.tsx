"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Keyboard } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const SHORTCUTS = [
  { key: "n", description: "New application" },
  { key: "b", description: "Go to Board view" },
  { key: "/", description: "Focus search" },
  { key: "?", description: "Show keyboard shortcuts" },
  { key: "Escape", description: "Close modal" },
  { key: "Cmd+K / Ctrl+K", description: "Open command palette" },
  { key: "g d", description: "Go to Dashboard" },
  { key: "g a", description: "Go to Applications" },
  { key: "g s", description: "Go to Statistics" },
]

export function KeyboardShortcuts() {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)
  const lastKeyRef = useRef<{ key: string; time: number } | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag = target.tagName.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) return

      // Two-key sequence: g d / g a / g s
      const now = Date.now()
      const last = lastKeyRef.current

      if (last && last.key === "g" && now - last.time < 1000) {
        lastKeyRef.current = null
        switch (e.key) {
          case "d":
            e.preventDefault()
            router.push("/")
            return
          case "a":
            e.preventDefault()
            router.push("/applications")
            return
          case "s":
            e.preventDefault()
            router.push("/statistics")
            return
        }
      }

      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        lastKeyRef.current = { key: "g", time: now }
        return
      }

      lastKeyRef.current = null

      switch (e.key) {
        case "n":
          e.preventDefault()
          router.push("/applications/new")
          break
        case "b":
          e.preventDefault()
          router.push("/applications/board")
          break
        case "/":
          e.preventDefault()
          document.dispatchEvent(new CustomEvent("focus-search"))
          break
        case "?":
          e.preventDefault()
          setShowHelp(prev => !prev)
          break
        case "Escape":
          setShowHelp(false)
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {SHORTCUTS.map(s => (
              <tr key={s.key}>
                <td className="py-2.5 pr-4">
                  <kbd className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs border border-slate-300 dark:border-slate-600">
                    {s.key}
                  </kbd>
                </td>
                <td className="py-2.5 text-slate-600 dark:text-slate-400">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
