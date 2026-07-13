"use client"

import { useEffect, useRef } from "react"
import { runLocalStorageMigration } from "@/lib/localStorage-migration"

export function LocalStorageMigration() {
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    runLocalStorageMigration()
      .then((result) => {
        if (result.migrated.length > 0) {
          console.log(`[migration] Migrated ${result.migrated.join(", ")}`)
        }
        if (result.errors.length > 0) {
          console.error(`[migration] Errors: ${result.errors.join("; ")}`)
        }
      })
      .catch((err) => {
        console.error("[migration] Failed:", err)
      })
  }, [])

  return null
}
