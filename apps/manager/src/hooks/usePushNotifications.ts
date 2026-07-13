"use client"

import { useEffect, useCallback } from "react"

export function usePushNotifications() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const notify = useCallback((title: string, body?: string) => {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    if (Notification.permission !== "granted") return
    try {
      new Notification(title, { body, icon: "/favicon.ico" })
    } catch {
      // Some browsers (e.g. Firefox on some pages) throw on new Notification
    }
  }, [])

  return { notify }
}
