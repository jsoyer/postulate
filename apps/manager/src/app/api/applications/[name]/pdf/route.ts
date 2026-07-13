import { NextResponse } from "next/server"
import { getCvApiClient, ApiError } from "@/lib/api-client"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const { searchParams } = new URL(request.url)
    const file = searchParams.get("file")

    if (!file) {
      return NextResponse.json({ error: "file param required" }, { status: 400 })
    }

    if (!file.endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files allowed" }, { status: 400 })
    }

    const url = getCvApiClient().getFileUrl(name, file)
    const response = await fetch(url, {
      headers: { "X-API-Key": process.env.CV_API_KEY ?? "" },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "File not found" },
        { status: response.status }
      )
    }

    const buffer = await response.arrayBuffer()
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file.replace(/["\r\n]/g, "")}"`,
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
