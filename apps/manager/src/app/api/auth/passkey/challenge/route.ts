import { NextResponse } from "next/server"
import { getPasskeyAuthenticationOptions } from "@/lib/auth"

export async function GET() {
  try {
    const options = await getPasskeyAuthenticationOptions()
    return NextResponse.json(options)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
