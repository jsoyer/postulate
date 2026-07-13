import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const STORE_FILE = path.join(DATA_DIR, "integrations.json")

export interface IntegrationsConfig {
  notion?: { token: string; databaseId: string }
  linkedin?: { accessToken: string; expiresAt: string; profileId?: string }
}

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function getIntegrations(): IntegrationsConfig {
  try {
    ensureDataDir()
    if (!fs.existsSync(STORE_FILE)) return {}
    const raw = fs.readFileSync(STORE_FILE, "utf-8")
    return JSON.parse(raw) as IntegrationsConfig
  } catch {
    return {}
  }
}

function writeIntegrations(config: IntegrationsConfig): void {
  ensureDataDir()
  fs.writeFileSync(STORE_FILE, JSON.stringify(config, null, 2), "utf-8")
}

export function saveNotionConfig(token: string, databaseId: string): void {
  const config = getIntegrations()
  config.notion = { token, databaseId }
  writeIntegrations(config)
}

export function saveLinkedInToken(accessToken: string, expiresAt: string): void {
  const config = getIntegrations()
  config.linkedin = { accessToken, expiresAt, profileId: config.linkedin?.profileId }
  writeIntegrations(config)
}

export function saveLinkedInProfileId(profileId: string): void {
  const config = getIntegrations()
  if (config.linkedin) {
    config.linkedin.profileId = profileId
    writeIntegrations(config)
  }
}

export function clearLinkedInToken(): void {
  const config = getIntegrations()
  delete config.linkedin
  writeIntegrations(config)
}

export function clearNotionConfig(): void {
  const config = getIntegrations()
  delete config.notion
  writeIntegrations(config)
}
