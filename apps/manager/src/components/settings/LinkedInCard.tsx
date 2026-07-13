"use client"

import { useState } from "react"
import { Loader2, Plug, Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

interface LinkedInCardProps {
  connected: boolean
  expiresAt: string | null
  clientIdMissing: boolean
  onConnect: () => void
  onDisconnect: () => void
}

export function LinkedInCard({ connected, expiresAt, clientIdMissing, onConnect, onDisconnect }: LinkedInCardProps) {
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">LinkedIn</CardTitle>
            <CardDescription>Post directly to LinkedIn via OAuth.</CardDescription>
          </div>
          {connected ? (
            <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 dark:border-green-800 dark:text-green-400 shrink-0">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-slate-500 border-slate-200 dark:border-slate-700 shrink-0">
              <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
              Not connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && expiresAt && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Expires: {new Date(expiresAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </p>
        )}

        {clientIdMissing && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
            <code>LINKEDIN_CLIENT_ID</code> is not configured. Set it in{" "}
            <code>.env.local</code> to enable LinkedIn OAuth.
          </div>
        )}

        <div className="flex items-center gap-2">
          {!connected && !clientIdMissing && (
            <Button size="sm" onClick={onConnect} className="gap-1.5">
              <Plug className="w-3.5 h-3.5" />
              Connect LinkedIn
            </Button>
          )}
          {connected && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              Disconnect
            </Button>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Requires a LinkedIn Developer App with <code>w_member_social</code> scope. Set{" "}
          <code>LINKEDIN_CLIENT_ID</code> and <code>LINKEDIN_CLIENT_SECRET</code> in{" "}
          <code>.env.local</code>.
        </p>
      </CardContent>
    </Card>
  )
}
