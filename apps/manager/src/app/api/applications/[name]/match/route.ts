import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const result = await getCvApiClient().getJobMatch(name)
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
    const body = await request.json().catch(() => ({}))
    const result = await getCvApiClient().runJobMatch(name, body.ai, body.threshold)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
