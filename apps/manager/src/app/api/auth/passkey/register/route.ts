import { NextResponse } from "next/server"
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration, getUsername } from "@/lib/auth"

export async function GET() {
  try {
    const username = getUsername()
    const options = await getPasskeyRegistrationOptions(username)
    return NextResponse.json(options)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { response, deviceName } = body

    if (!response) {
      return NextResponse.json({ error: "Missing response" }, { status: 400 })
    }

    const label = typeof deviceName === "string" && deviceName.trim()
      ? deviceName.trim()
      : "Unknown device"

    const result = await verifyPasskeyRegistration(response, label)

    if (!result.verified) {
      return NextResponse.json({ error: "Registration failed" }, { status: 400 })
    }

    return NextResponse.json({ verified: true, credentialId: result.credentialId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
