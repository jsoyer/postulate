"use client"

import { createContext, useContext, useSyncExternalStore } from "react"

export interface SelectedApp {
  name: string
  company: string
  position: string
}

interface SelectedAppContextType {
  selectedApp: SelectedApp | null
  setSelectedApp: (app: SelectedApp | null) => void
}

const SelectedAppContext = createContext<SelectedAppContextType>({
  selectedApp: null,
  setSelectedApp: () => {},
})

const STORAGE_KEY = "selected-app"

// Cache last raw string + parsed value so getSnapshot returns a stable
// reference when the stored value hasn't changed (required by useSyncExternalStore).
let _cachedRaw: string | null = undefined as unknown as string | null
let _cachedValue: SelectedApp | null = null

function getSnapshot(): SelectedApp | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === _cachedRaw) return _cachedValue
    _cachedRaw = raw
    _cachedValue = raw ? JSON.parse(raw) : null
    return _cachedValue
  } catch { return _cachedValue }
}

function getServerSnapshot(): null {
  return null
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

export function SelectedAppProvider({ children }: { children: React.ReactNode }) {
  const selectedApp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setSelectedApp = (app: SelectedApp | null) => {
    try {
      const raw = app ? JSON.stringify(app) : null
      if (raw) localStorage.setItem(STORAGE_KEY, raw)
      else localStorage.removeItem(STORAGE_KEY)
      // Invalidate cache so next getSnapshot reads the new value
      _cachedRaw = undefined as unknown as string | null
      // Notify subscribers in the same tab
      window.dispatchEvent(new StorageEvent("storage"))
    } catch {}
  }

  return (
    <SelectedAppContext.Provider value={{ selectedApp, setSelectedApp }}>
      {children}
    </SelectedAppContext.Provider>
  )
}

export function useSelectedApp() { return useContext(SelectedAppContext) }
