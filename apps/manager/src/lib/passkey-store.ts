import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const STORE_FILE = path.join(DATA_DIR, "passkey-credentials.json")

export interface StoredCredential {
  id: string
  publicKey: number[]
  counter: number
  transports?: string[]
  deviceName: string
  createdAt: string
}

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function getCredentials(): StoredCredential[] {
  try {
    ensureDataDir()
    if (!fs.existsSync(STORE_FILE)) return []
    const raw = fs.readFileSync(STORE_FILE, "utf-8")
    return JSON.parse(raw) as StoredCredential[]
  } catch {
    return []
  }
}

function writeCredentials(creds: StoredCredential[]): void {
  ensureDataDir()
  fs.writeFileSync(STORE_FILE, JSON.stringify(creds, null, 2), "utf-8")
}

export function saveCredential(cred: StoredCredential): void {
  const creds = getCredentials()
  const idx = creds.findIndex((c) => c.id === cred.id)
  if (idx >= 0) {
    creds[idx] = cred
  } else {
    creds.push(cred)
  }
  writeCredentials(creds)
}

export function updateCounter(id: string, newCounter: number): void {
  const creds = getCredentials()
  const cred = creds.find((c) => c.id === id)
  if (cred) {
    cred.counter = newCounter
    writeCredentials(creds)
  }
}

export function deleteCredential(id: string): void {
  const creds = getCredentials().filter((c) => c.id !== id)
  writeCredentials(creds)
}

// In-memory challenge store (short-lived, no persistence needed)
interface ChallengeEntry {
  challenge: string
  expires: number
}

const challenges = new Map<string, ChallengeEntry>()

export const challengeStore = {
  setChallenge(key: string, challenge: string): void {
    challenges.set(key, {
      challenge,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    })
  },

  consumeChallenge(key: string): string | null {
    const entry = challenges.get(key)
    if (!entry) return null
    challenges.delete(key)
    if (Date.now() > entry.expires) return null
    return entry.challenge
  },
}
