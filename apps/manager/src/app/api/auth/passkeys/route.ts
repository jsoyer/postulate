import { NextResponse } from "next/server"
import { getCredentials, deleteCredential } from "@/lib/passkey-store"

export async function GET() {
  try {
    const creds = getCredentials()
    const safe = creds.map(({ id, deviceName, createdAt, transports }) => ({
      id,
      deviceName,
      createdAt,
      transports,
    }))
    return NextResponse.json(safe)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing credential id" }, { status: 400 })
    }

    deleteCredential(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
