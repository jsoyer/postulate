import { NextResponse } from "next/server"
import { getCvApiClient } from "@/lib/api-client"

export async function GET() {
  const client = getCvApiClient()

  try {
    const healthy = await client.health()

    if (!healthy) {
      return NextResponse.json({ status: "degraded", ai_providers: {} })
    }

    return NextResponse.json({ status: "ok", ai_providers: {} })
  } catch {
    return NextResponse.json({ status: "down", ai_providers: {} }, { status: 503 })
  }
}
