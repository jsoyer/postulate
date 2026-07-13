import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") ?? undefined
    const client = getCvApiClient()
    const applications = await client.listApplications(status)
    return NextResponse.json({ applications })
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
