"use client"

import { useState, useEffect, useCallback } from "react"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PasskeyList } from "./PasskeyList"
import { PasskeyRegister } from "./PasskeyRegister"

interface PasskeyInfo {
  id: string
  deviceName: string
  createdAt: string
}

export function SettingsSecurity() {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadPasskeys = useCallback(async () => {
    setLoadingPasskeys(true)
    try {
      const res = await fetch("/api/auth/passkeys")
      if (res.ok) {
        const data = await res.json()
        setPasskeys(Array.isArray(data) ? data : [])
      }
    } catch {
      setPasskeys([])
    } finally {
      setLoadingPasskeys(false)
    }
  }, [])

  useEffect(() => {
    loadPasskeys()
  }, [loadPasskeys])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch("/api/auth/passkeys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        await loadPasskeys()
      }
    } catch {
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Passkeys</CardTitle>
        <CardDescription>
          Manage hardware or biometric passkeys for passwordless sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PasskeyList
          passkeys={passkeys}
          loading={loadingPasskeys}
          deletingId={deletingId}
          onDelete={handleDelete}
        />

        <Separator />

        <PasskeyRegister onRegistered={loadPasskeys} />
      </CardContent>
    </Card>
  )
}
