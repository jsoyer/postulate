/**
 * localStorage → cv-api migration script.
 *
 * Runs once on first load after deployment. Reads all business data from
 * localStorage and POSTs it to the new API endpoints. Sets a flag so it
 * never runs again.
 *
 * The 5 UI-state localStorage keys (theme, sidebar-collapsed, selected-app,
 * deadline-notified, log-level) are NOT touched.
 */

const MIGRATION_FLAG = "ls-migration-done"

const BUSINESS_KEYS = [
  "app-ai-provider",
  "app-theme",
  "app-tags",
  "ats-scores",
  "cv-health-scores",
  "cv-health-score",
  "cv-action-history",
] as const

type BusinessKey = (typeof BUSINESS_KEYS)[number]

interface MigrationResult {
  migrated: string[]
  skipped: string[]
  errors: string[]
}

async function migrateTags(): Promise<void> {
  const raw = localStorage.getItem("app-tags")
  if (!raw) return
  const data = JSON.parse(raw) as Record<string, string[]>
  for (const [name, tags] of Object.entries(data)) {
    if (!Array.isArray(tags) || tags.length === 0) continue
    await fetch(`/api/applications/${encodeURIComponent(name)}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    })
  }
}

async function migrateAtsScores(): Promise<void> {
  const raw = localStorage.getItem("ats-scores")
  if (!raw) return
  const data = JSON.parse(raw) as Record<string, Array<{ date: string; score: number }> | number>
  for (const [name, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        await fetch(`/api/applications/${encodeURIComponent(name)}/ats-scores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        })
      }
    }
  }
}

async function migratePreferences(): Promise<void> {
  const aiProviderRaw = localStorage.getItem("app-ai-provider")
  const themeRaw = localStorage.getItem("app-theme")

  const aiProviders = aiProviderRaw ? (JSON.parse(aiProviderRaw) as Record<string, string>) : {}
  const themes = themeRaw ? (JSON.parse(themeRaw) as Record<string, string>) : {}

  const allNames = new Set([...Object.keys(aiProviders), ...Object.keys(themes)])
  for (const name of allNames) {
    const prefs: { ai_provider?: string; theme?: string } = {}
    if (aiProviders[name]) prefs.ai_provider = aiProviders[name]
    if (themes[name]) prefs.theme = themes[name]
    if (Object.keys(prefs).length === 0) continue

    await fetch(`/api/applications/${encodeURIComponent(name)}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    })
  }
}

async function migrateActionHistory(): Promise<void> {
  const raw = localStorage.getItem("cv-action-history")
  if (!raw) return
  const entries = JSON.parse(raw) as Array<{
    action: string
    params: Record<string, string>
    lines: string[]
    timestamp: number
    success: boolean
  }>
  for (const entry of entries) {
    await fetch("/api/action-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: entry.action,
        params: entry.params,
        timestamp: entry.timestamp,
        success: entry.success,
      }),
    })
  }
}

async function migrateHealthScores(): Promise<void> {
  const raw = localStorage.getItem("cv-health-scores")
  if (!raw) return
  const data = JSON.parse(raw) as Record<string, number>
  for (const [name, score] of Object.entries(data)) {
    if (typeof score !== "number") continue
    await fetch(`/api/applications/${encodeURIComponent(name)}/ats-scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: new Date().toISOString(), score }),
    })
  }
}

const MIGRATION_MAP: Record<BusinessKey, () => Promise<void>> = {
  "app-tags": migrateTags,
  "ats-scores": migrateAtsScores,
  "app-ai-provider": migratePreferences,
  "app-theme": migratePreferences,
  "cv-health-scores": migrateHealthScores,
  "cv-health-score": async () => {},
  "cv-action-history": migrateActionHistory,
}

export async function runLocalStorageMigration(): Promise<MigrationResult> {
  if (localStorage.getItem(MIGRATION_FLAG) === "true") {
    return { migrated: [], skipped: [...BUSINESS_KEYS] as string[], errors: [] }
  }

  const result: MigrationResult = { migrated: [], skipped: [], errors: [] }
  const executed = new Set<string>()

  for (const key of BUSINESS_KEYS) {
    const value = localStorage.getItem(key)
    if (!value) {
      result.skipped.push(key)
      continue
    }

    const migrator = MIGRATION_MAP[key]
    if (!migrator || executed.has(key)) {
      if (!executed.has(key)) result.skipped.push(key)
      continue
    }

    try {
      await migrator()
      result.migrated.push(key)
      executed.add(key)
    } catch (err) {
      result.errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  localStorage.setItem(MIGRATION_FLAG, "true")
  return result
}
