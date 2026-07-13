import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"
import { AtsScoreSchema, zodError } from "@/lib/validation"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const result = await getCvApiClient().getAtsScores(name)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const body = await request.json()
    const parsed = AtsScoreSchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)
    const { date, score } = parsed.data

    await getCvApiClient().recordAtsScore(name, { date, score })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
