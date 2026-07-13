import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"
import { SettingsSchema, zodError } from "@/lib/validation"

export async function GET() {
  try {
    const client = getCvApiClient()
    const settings = await client.getSettings()
    return NextResponse.json(settings)
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = SettingsSchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)
    const client = getCvApiClient()
    const updated = await client.updateSettings(parsed.data as import("@/lib/api-types").Settings)
    return NextResponse.json(updated)
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
