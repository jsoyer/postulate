import { type NextRequest, NextResponse } from "next/server"
import { getCvApiClient } from "@/lib/api-client"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string; filename: string }> }
) {
  const { name, filename } = await params
  const client = getCvApiClient()
  const url = client.getFileUrl(name, filename)

  const upstream = await fetch(url, {
    headers: { "X-API-Key": process.env.CV_API_KEY || "" },
  })

  if (!upstream.ok) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream"
  const buffer = await upstream.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename.replace(/["\r\n]/g, "")}"`,
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string; filename: string }> }
) {
  const { name, filename } = await params
  const client = getCvApiClient()
  const url = client.getFileUrl(name, filename)

  const upstream = await fetch(url, {
    method: "DELETE",
    headers: { "X-API-Key": process.env.CV_API_KEY || "" },
  })

  if (!upstream.ok) {
    if (upstream.status === 404) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Delete failed" }, { status: upstream.status })
  }

  return NextResponse.json({ ok: true })
}
