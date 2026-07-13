import { useEffect, useRef, useState } from "react"
import { CvApiClient } from "../lib/api-client"
import { getSettings, saveSettings } from "../lib/storage"
import type { ExtensionSettings } from "../lib/types"

type SaveState = "idle" | "saving" | "saved" | "error"
type TestState = "idle" | "testing" | "ok" | "fail"

// ---------------------------------------------------------------------------
// Form field
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string
  id: string
  children: React.ReactNode
  hint?: string
}

function Field({ label, id, children, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-200">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Options page
// ---------------------------------------------------------------------------

export function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>({
    apiUrl: "",
    apiKey: "",
    theme: "system",
    badgeEnabled: true,
    notificationsEnabled: true,
  })
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [testState, setTestState] = useState<TestState>("idle")
  const [testMessage, setTestMessage] = useState("")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void getSettings().then(setSettings)
  }, [])

  function handleChange<K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaveState("idle")
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveState("saving")

    try {
      await saveSettings(settings)
      setSaveState("saved")
    } catch {
      setSaveState("error")
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaveState("idle"), 3000)
  }

  async function handleTestConnection() {
    if (!settings.apiUrl || !settings.apiKey) {
      setTestState("fail")
      setTestMessage("API URL and API key are required.")
      return
    }

    setTestState("testing")
    setTestMessage("")

    try {
      const client = new CvApiClient(settings.apiUrl, settings.apiKey)
      const health = await client.health()

      if (health.status === "ok") {
        setTestState("ok")
        const version = health.version ? ` (v${health.version})` : ""
        setTestMessage(`Connected successfully${version}`)
      } else {
        setTestState("fail")
        setTestMessage(`API returned status: ${health.status}`)
      }
    } catch (err) {
      setTestState("fail")
      setTestMessage(
        err instanceof Error ? err.message : "Connection failed."
      )
    }
  }

  const saveLabel: Record<SaveState, string> = {
    idle: "Save settings",
    saving: "Saving...",
    saved: "Saved",
    error: "Save failed",
  }

  const testLabel: Record<TestState, string> = {
    idle: "Test connection",
    testing: "Testing...",
    ok: "Connected",
    fail: "Failed",
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="mx-auto max-w-xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold">CV Pipeline Extension</h1>
            <p className="text-sm text-gray-400">Settings</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-8">
          {/* API Connection */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              API Connection
            </h2>

            <Field
              label="cv-api URL"
              id="apiUrl"
              hint="The base URL of your running cv-api instance."
            >
              <input
                id="apiUrl"
                type="url"
                value={settings.apiUrl}
                onChange={(e) => handleChange("apiUrl", e.target.value)}
                placeholder="http://localhost:8080"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                required
                autoComplete="off"
              />
            </Field>

            <Field
              label="API Key"
              id="apiKey"
              hint="The X-API-Key header value configured in cv-api."
            >
              <input
                id="apiKey"
                type="password"
                value={settings.apiKey}
                onChange={(e) => handleChange("apiKey", e.target.value)}
                placeholder="your-secret-api-key"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                autoComplete="current-password"
              />
            </Field>

            {/* Test connection */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleTestConnection()}
                disabled={testState === "testing"}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {testState === "testing" && (
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                {testLabel[testState]}
              </button>

              {testMessage && (
                <span
                  className={`text-sm ${
                    testState === "ok" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {testMessage}
                </span>
              )}
            </div>
          </section>

          {/* Preferences */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Preferences
            </h2>

            <Field label="Theme" id="theme">
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) =>
                  handleChange(
                    "theme",
                    e.target.value as ExtensionSettings["theme"]
                  )
                }
                className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="system">System default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </Field>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.badgeEnabled}
                  onChange={(e) => handleChange("badgeEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-200">
                    Badge count
                  </span>
                  <p className="text-xs text-gray-500">
                    Show the number of active applications on the extension icon.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notificationsEnabled}
                  onChange={(e) =>
                    handleChange("notificationsEnabled", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-200">
                    Follow-up notifications
                  </span>
                  <p className="text-xs text-gray-500">
                    Remind you to follow up on applications after 7 days.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saveState === "saving"}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
            >
              {saveLabel[saveState]}
            </button>

            {saveState === "saved" && (
              <span className="text-sm text-green-400">Settings saved.</span>
            )}
            {saveState === "error" && (
              <span className="text-sm text-red-400">
                Failed to save. Try again.
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
