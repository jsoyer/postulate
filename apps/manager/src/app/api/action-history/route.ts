import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"
import { ActionHistoryEntrySchema, zodError } from "@/lib/validation"

export async function GET() {
  try {
    const result = await getCvApiClient().getActionHistory()
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ActionHistoryEntrySchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)

    await getCvApiClient().recordAction(parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await getCvApiClient().clearActionHistory()
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
