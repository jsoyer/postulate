"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2, KeyRound, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function LoginPage() {
  const router = useRouter()

  // Password form state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [showTotp, setShowTotp] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  // Passkey state
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeyError, setPasskeyError] = useState("")
  const [hasPasskeys, setHasPasskeys] = useState(false)
  const [passkeysChecked, setPasskeysChecked] = useState(false)

  useEffect(() => {
    fetch("/api/auth/passkeys")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          setHasPasskeys(true)
        }
      })
      .catch(() => {})
      .finally(() => setPasskeysChecked(true))
  }, [])

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    setPasswordLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          ...(showTotp && totpCode ? { totpCode } : {}),
        }),
      })

      if (res.ok) {
        router.push("/")
        router.refresh()
        return
      }

      const data = await res.json()
      const msg: string = data.error ?? "Login failed"

      if (res.status === 401 && msg.toLowerCase().includes("otp")) {
        setShowTotp(true)
        setPasswordError("Please enter your OTP code.")
      } else {
        setPasswordError(msg)
      }
    } catch {
      setPasswordError("Network error. Please try again.")
    } finally {
      setPasswordLoading(false)
    }
  }

  const handlePasskeyLogin = useCallback(async () => {
    setPasskeyError("")
    setPasskeyLoading(true)

    try {
      const challengeRes = await fetch("/api/auth/passkey/challenge")
      if (!challengeRes.ok) {
        setPasskeyError("Failed to get authentication options.")
        return
      }
      const optionsJSON = await challengeRes.json()

      const { startAuthentication } = await import("@simplewebauthn/browser")
      const authResponse = await startAuthentication({ optionsJSON })

      const verifyRes = await fetch("/api/auth/passkey/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResponse }),
      })

      if (verifyRes.ok) {
        router.push("/")
        router.refresh()
        return
      }

      const data = await verifyRes.json()
      setPasskeyError(data.error ?? "Passkey authentication failed.")
    } catch (err: unknown) {
      // User cancelled the passkey dialog
      const message = err instanceof Error ? err.message : ""
      if (message.toLowerCase().includes("cancel") || message.toLowerCase().includes("abort")) {
        setPasskeyError("")
      } else {
        setPasskeyError("Passkey authentication failed.")
      }
    } finally {
      setPasskeyLoading(false)
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">CV Manager</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Passkey button */}
          {passkeysChecked && hasPasskeys && (
            <>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading}
                >
                  {passkeyLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  Sign in with passkey
                </Button>

                {passkeyError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{passkeyError}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">or</span>
                <Separator className="flex-1" />
              </div>
            </>
          )}

          {/* Password form */}
          <form onSubmit={handlePasswordLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={passwordLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={passwordLoading}
              />
            </div>

            {showTotp && (
              <div className="space-y-1.5">
                <Label htmlFor="totp">One-time code</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  maxLength={6}
                  disabled={passwordLoading}
                  autoFocus
                />
              </div>
            )}

            {passwordError && (
              <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            )}

            <Button type="submit" className="w-full gap-2" disabled={passwordLoading}>
              {passwordLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
