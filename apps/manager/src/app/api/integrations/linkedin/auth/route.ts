import { NextResponse } from "next/server"

// In-memory OAuth state store with 10-minute expiry
interface StateEntry {
  expires: number
}

const stateStore = new Map<string, StateEntry>()

function generateState(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function consumeState(state: string): boolean {
  const entry = stateStore.get(state)
  if (!entry) return false
  stateStore.delete(state)
  if (Date.now() > entry.expires) return false
  return true
}

export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "LINKEDIN_CLIENT_ID not configured" }, { status: 400 })
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const callbackUrl = `${baseUrl}/api/integrations/linkedin/callback`

  const state = generateState()
  stateStore.set(state, { expires: Date.now() + 10 * 60 * 1000 })

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "w_member_social",
    state,
  })

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  return NextResponse.redirect(authUrl)
}
