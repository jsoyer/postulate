import { NextRequest, NextResponse } from "next/server"
import { saveLinkedInToken } from "@/lib/integrations-store"
import { consumeState } from "../auth/route"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&linkedin=error&reason=${encodeURIComponent(error)}`)
  }

  if (!state || !consumeState(state)) {
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&linkedin=error&reason=invalid_state`)
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&linkedin=error&reason=missing_code`)
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&linkedin=error&reason=missing_credentials`)
  }

  const callbackUrl = `${baseUrl}/api/integrations/linkedin/callback`

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&linkedin=error&reason=token_exchange_failed`)
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string
      expires_in: number
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    saveLinkedInToken(tokenData.access_token, expiresAt)

    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&linkedin=connected`)
  } catch {
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&linkedin=error&reason=fetch_failed`)
  }
}
