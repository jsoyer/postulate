import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"
import { CreateApplicationSchema, zodError } from "@/lib/validation"

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = CreateApplicationSchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)
    const { company, position, url } = parsed.data

    const client = getCvApiClient()
    const application = await client.createApplication({ company, position, url })
    return NextResponse.json({ success: true, application })
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
