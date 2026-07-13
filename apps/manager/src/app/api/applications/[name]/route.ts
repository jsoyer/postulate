import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const client = getCvApiClient()
    const application = await client.getApplication(name)
    return NextResponse.json(application)
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      const status = error.statusCode === 404 ? 404 : error.statusCode
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
