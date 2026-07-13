import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

export async function GET() {
  try {
    const client = getCvApiClient()
    const dashboard = await client.getDashboard()
    const response = NextResponse.json(dashboard)
    response.headers.set("Cache-Control", "private, s-maxage=30, stale-while-revalidate=60")
    return response
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
