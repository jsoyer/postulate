import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"
import { NotesSchema, zodError } from "@/lib/validation"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const result = await getCvApiClient().getNotes(name)
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
    const parsed = NotesSchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)
    const { content } = parsed.data

    await getCvApiClient().updateNotes(name, content)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
