"use client"

import { useState, useEffect, useCallback } from "react"
import { NotionCard } from "./NotionCard"
import { LinkedInCard } from "./LinkedInCard"
import { toast } from "sonner"

export function SettingsIntegrations() {
  const [notionConfigured, setNotionConfigured] = useState(false)
  const [notionDatabaseId, setNotionDatabaseId] = useState("")
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [linkedinExpiresAt, setLinkedinExpiresAt] = useState<string | null>(null)
  const [linkedinClientIdMissing, setLinkedinClientIdMissing] = useState(false)

  const loadNotion = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/notion")
      if (res.ok) {
        const data = await res.json()
        setNotionConfigured(data.configured)
        setNotionDatabaseId(data.databaseId ?? "")
      }
    } catch {}
  }, [])

  const loadLinkedIn = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/linkedin")
      if (res.ok) {
        const data = await res.json()
        setLinkedinConnected(data.connected)
        setLinkedinExpiresAt(data.expiresAt)
      }
      const authRes = await fetch("/api/integrations/linkedin/auth", { redirect: "manual" })
      if (authRes.status === 400) {
        setLinkedinClientIdMissing(true)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadNotion()
    loadLinkedIn()
  }, [loadNotion, loadLinkedIn])

  const handleNotionSave = async (token: string, databaseId: string) => {
    try {
      const res = await fetch("/api/integrations/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, databaseId }),
      })
      if (res.ok) {
        toast.success("Notion configuration saved")
        await loadNotion()
      } else {
        const data = await res.json()
        toast.error(data.error ?? "Failed to save Notion config")
      }
    } catch {
      toast.error("Failed to save Notion config")
    }
  }

  const handleNotionDisconnect = async () => {
    try {
      const res = await fetch("/api/integrations/notion", { method: "DELETE" })
      if (res.ok) {
        toast.success("Notion disconnected")
        setNotionConfigured(false)
        setNotionDatabaseId("")
      } else {
        toast.error("Failed to disconnect Notion")
      }
    } catch {
      toast.error("Failed to disconnect Notion")
    }
  }

  const handleLinkedInConnect = () => {
    window.location.href = "/api/integrations/linkedin/auth"
  }

  const handleLinkedInDisconnect = async () => {
    try {
      const res = await fetch("/api/integrations/linkedin", { method: "DELETE" })
      if (res.ok) {
        toast.success("LinkedIn disconnected")
        setLinkedinConnected(false)
        setLinkedinExpiresAt(null)
      } else {
        toast.error("Failed to disconnect LinkedIn")
      }
    } catch {
      toast.error("Failed to disconnect LinkedIn")
    }
  }

  return (
    <div className="space-y-4">
      <NotionCard
        configured={notionConfigured}
        databaseId={notionDatabaseId}
        onSave={handleNotionSave}
        onDisconnect={handleNotionDisconnect}
      />
      <LinkedInCard
        connected={linkedinConnected}
        expiresAt={linkedinExpiresAt}
        clientIdMissing={linkedinClientIdMissing}
        onConnect={handleLinkedInConnect}
        onDisconnect={handleLinkedInDisconnect}
      />
    </div>
  )
}
