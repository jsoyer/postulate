import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const body = await request.json()

    await getCvApiClient().updateApplication(name, {
      company: body.company,
      position: body.position,
      followup_date: body.followup_date,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
