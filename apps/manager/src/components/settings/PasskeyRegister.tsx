"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface PasskeyRegisterProps {
  onRegistered: () => void
}

export function PasskeyRegister({ onRegistered }: PasskeyRegisterProps) {
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState("")
  const [deviceName, setDeviceName] = useState("")

  const handleRegister = async () => {
    setRegisterError("")
    setRegisterLoading(true)
    try {
      const optionsRes = await fetch("/api/auth/passkey/register")
      if (!optionsRes.ok) {
        setRegisterError("Failed to get registration options.")
        return
      }
      const optionsJSON = await optionsRes.json()

      const { startRegistration } = await import("@simplewebauthn/browser")
      const regResponse = await startRegistration({ optionsJSON })

      const label = deviceName.trim() || "My device"

      const verifyRes = await fetch("/api/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: regResponse, deviceName: label }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setRegisterError(data.error ?? "Registration failed.")
        return
      }

      setDeviceName("")
      onRegistered()
      toast.success("Passkey registered successfully")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ""
      if (message.toLowerCase().includes("cancel") || message.toLowerCase().includes("abort")) {
        setRegisterError("")
      } else {
        setRegisterError("Registration failed.")
      }
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
        Register a new passkey
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="passkey-device-name">Device name</Label>
        <Input
          id="passkey-device-name"
          type="text"
          placeholder="e.g. MacBook Touch ID"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          disabled={registerLoading}
          className="max-w-xs"
        />
      </div>

      {registerError && (
        <p className="text-sm text-red-600 dark:text-red-400">{registerError}</p>
      )}

      <Button
        size="sm"
        onClick={handleRegister}
        disabled={registerLoading}
        className="gap-1.5"
      >
        {registerLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        Register passkey
      </Button>
    </div>
  )
}
