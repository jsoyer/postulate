"use client"

import { useState } from "react"
import { CheckCircle2, Circle, Loader2, XCircle, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done" | "error"

interface StepMeta {
  index: number
  label: string
  description: string
}

const STEPS: StepMeta[] = [
  { index: 0, label: "Connect",      description: "Verify cv-api is reachable" },
  { index: 1, label: "Authenticate", description: "Confirm credentials are set" },
  { index: 2, label: "Verify",       description: "Review configuration summary" },
]

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  current,
  statuses,
}: {
  steps: StepMeta[]
  current: number
  statuses: StepStatus[]
}) {
  return (
    <ol className="flex items-center gap-0 w-full mb-8">
      {steps.map((step, i) => {
        const status = statuses[i]
        const isLast = i === steps.length - 1

        return (
          <li key={step.index} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  status === "done"
                    ? "border-green-500 bg-green-500 text-white"
                    : status === "error"
                      ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950"
                      : status === "active"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background text-muted-foreground",
                ].join(" ")}
              >
                {status === "done" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : status === "error" ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={[
                  "text-xs font-medium whitespace-nowrap",
                  status === "active" ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={[
                  "flex-1 h-0.5 mx-2 mt-[-12px] rounded-full transition-colors",
                  status === "done" ? "bg-green-500" : "bg-muted",
                ].join(" ")}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── Step 1 — Connect ─────────────────────────────────────────────────────────

type ConnectResult = "idle" | "checking" | "ok" | "error"

function StepConnect({
  onNext,
}: {
  onNext: (url: string) => void
}) {
  const [url, setUrl] = useState("http://localhost:8765")
  const [result, setResult] = useState<ConnectResult>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const handleTest = async () => {
    setResult("checking")
    setErrorMsg("")
    try {
      const res = await fetch("/api/health")
      if (res.ok) {
        const data = await res.json()
        if (data.status === "ok" || data.status === "healthy") {
          setResult("ok")
        } else {
          setResult("error")
          setErrorMsg(`API returned status: ${data.status ?? "unknown"}`)
        }
      } else {
        setResult("error")
        setErrorMsg(`HTTP ${res.status} — ${res.statusText}`)
      }
    } catch (err) {
      setResult("error")
      setErrorMsg(err instanceof Error ? err.message : "Connection refused")
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="cv-api-url">CV API URL</Label>
        <Input
          id="cv-api-url"
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="http://localhost:8765"
        />
        <p className="text-xs text-muted-foreground">
          Set <code className="font-mono bg-muted px-1 rounded">CV_API_URL</code> in{" "}
          <code className="font-mono bg-muted px-1 rounded">.env.local</code> to this value, then
          restart the dev server.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={result === "checking"}
        >
          {result === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
          Test connection
        </Button>

        {result === "ok" && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Connected
          </span>
        )}
        {result === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            {errorMsg || "Unreachable"}
          </span>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => onNext(url)} disabled={result !== "ok"}>
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2 — Authenticate ────────────────────────────────────────────────────

type LoginResult = "idle" | "checking" | "ok" | "error"

function StepAuthenticate({
  onNext,
}: {
  onNext: (username: string) => void
}) {
  const [username, setUsername] = useState("jerome")
  const [password, setPassword] = useState("")
  const [result, setResult] = useState<LoginResult>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const handleTestLogin = async () => {
    setResult("checking")
    setErrorMsg("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        setResult("ok")
      } else {
        const body = await res.json().catch(() => ({}))
        setResult("error")
        setErrorMsg(body?.error ?? `HTTP ${res.status}`)
      }
    } catch (err) {
      setResult("error")
      setErrorMsg(err instanceof Error ? err.message : "Request failed")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300 space-y-2">
        <p className="font-medium">Environment variables required</p>
        <p>
          Authentication credentials are read from server-side environment
          variables and cannot be set from this UI. Add the following to{" "}
          <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">.env.local</code>:
        </p>
        <pre className="font-mono text-xs mt-1 space-y-0.5 leading-5">
          AUTH_USERNAME=your_username{"\n"}
          AUTH_PASSWORD=your_password{"\n"}
          AUTH_SECRET=change_me_in_production
        </pre>
        <p>Restart the dev server after editing the file.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="test-username">Username</Label>
          <Input
            id="test-username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="jerome"
            autoComplete="username"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="test-password">Password</Label>
          <Input
            id="test-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password to test"
            autoComplete="current-password"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={handleTestLogin}
          disabled={result === "checking" || !password}
        >
          {result === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
          Test login
        </Button>

        {result === "ok" && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Login successful
          </span>
        )}
        {result === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            {errorMsg || "Login failed"}
          </span>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => onNext(username)} disabled={result !== "ok"}>
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3 — Verify ──────────────────────────────────────────────────────────

function StepVerify({
  apiUrl,
  username,
}: {
  apiUrl: string
  username: string
}) {
  const items: { label: string; value: string; ok: boolean }[] = [
    { label: "CV API URL",    value: apiUrl,      ok: true },
    { label: "Auth username", value: username,    ok: true },
    { label: "Auth password", value: "set",       ok: true },
    { label: "Connection",    value: "reachable", ok: true },
    { label: "Login",         value: "verified",  ok: true },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-lg border divide-y divide-border overflow-hidden">
        {items.map(item => (
          <div
            key={item.label}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className="flex items-center gap-2 font-mono font-medium">
              {item.value}
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Next steps</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Make sure <code className="font-mono bg-muted px-1 rounded">CV_API_KEY</code> is set in{" "}
            <code className="font-mono bg-muted px-1 rounded">.env.local</code> if your cv-api
            requires authentication.
          </li>
          <li>
            Visit{" "}
            <Link href="/settings" className="underline hover:text-foreground transition-colors">
              Settings
            </Link>{" "}
            to change AI provider defaults or notification preferences.
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Settings
        </Link>
        <Button asChild>
          <Link href="/">
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [apiUrl, setApiUrl] = useState("http://localhost:8765")
  const [username, setUsername] = useState("jerome")

  const statuses: StepStatus[] = STEPS.map((_, i) => {
    if (i < currentStep) return "done"
    if (i === currentStep) return "active"
    return "pending"
  })

  return (
    <div className="min-h-full flex items-start justify-center p-4 md:p-8">
      <div className="w-full max-w-lg mt-8">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Setup Wizard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect cv-manager to your cv-api instance in a few steps.
          </p>
        </div>

        <StepIndicator steps={STEPS} current={currentStep} statuses={statuses} />

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {STEPS[currentStep].label}
            </CardTitle>
            <CardDescription>
              {STEPS[currentStep].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 0 && (
              <StepConnect
                onNext={url => {
                  setApiUrl(url)
                  setCurrentStep(1)
                }}
              />
            )}
            {currentStep === 1 && (
              <StepAuthenticate
                onNext={u => {
                  setUsername(u)
                  setCurrentStep(2)
                }}
              />
            )}
            {currentStep === 2 && (
              <StepVerify apiUrl={apiUrl} username={username} />
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
