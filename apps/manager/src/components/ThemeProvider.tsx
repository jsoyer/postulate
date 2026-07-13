"use client"

import { createContext, useContext, useEffect, useSyncExternalStore } from "react"

type Theme = "light" | "dark"
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} })

const THEME_KEY = "theme"

// Stable cache — same reference when value unchanged (required by useSyncExternalStore)
let _cachedRaw: string | null = undefined as unknown as string | null
let _cachedTheme: Theme = "light"

function getThemeSnapshot(): Theme {
  const raw = localStorage.getItem(THEME_KEY)
  if (raw === _cachedRaw) return _cachedTheme
  _cachedRaw = raw
  if (raw === "dark" || raw === "light") {
    _cachedTheme = raw
  } else {
    _cachedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return _cachedTheme
}

function getThemeServerSnapshot(): Theme {
  return "light"
}

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback)
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  mq.addEventListener("change", callback)
  return () => {
    window.removeEventListener("storage", callback)
    mq.removeEventListener("change", callback)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot)

  // Sync <html> class with theme after hydration
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light"
    _cachedRaw = undefined as unknown as string | null  // invalidate cache
    localStorage.setItem(THEME_KEY, next)
    window.dispatchEvent(new StorageEvent("storage"))
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() { return useContext(ThemeContext) }
