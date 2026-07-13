import { NextRequest, NextResponse } from "next/server"
import { getIntegrations, saveNotionConfig, clearNotionConfig } from "@/lib/integrations-store"

export async function GET() {
  const config = getIntegrations()
  const notion = config.notion
  return NextResponse.json({
    configured: !!(notion?.token && notion?.databaseId),
    databaseId: notion?.databaseId ?? null,
  })
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { token, databaseId } = body as Record<string, unknown>

  if (!token || typeof token !== "string" || token.trim() === "") {
    return NextResponse.json({ error: "token is required" }, { status: 400 })
  }
  if (!databaseId || typeof databaseId !== "string" || databaseId.trim() === "") {
    return NextResponse.json({ error: "databaseId is required" }, { status: 400 })
  }

  saveNotionConfig(token.trim(), databaseId.trim())
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  clearNotionConfig()
  return NextResponse.json({ ok: true })
}
