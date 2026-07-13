import { NextResponse } from "next/server"
import { getIntegrations, clearLinkedInToken } from "@/lib/integrations-store"

export async function GET() {
  const config = getIntegrations()
  const linkedin = config.linkedin
  return NextResponse.json({
    connected: !!(linkedin?.accessToken),
    expiresAt: linkedin?.expiresAt ?? null,
  })
}

export async function DELETE() {
  clearLinkedInToken()
  return NextResponse.json({ ok: true })
}
