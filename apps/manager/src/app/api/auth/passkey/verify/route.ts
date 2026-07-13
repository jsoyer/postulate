import { NextResponse } from "next/server"
import { verifyPasskeyAuthentication, createSession, getUsername } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { response } = body

    if (!response) {
      return NextResponse.json({ error: "Missing response" }, { status: 400 })
    }

    const result = await verifyPasskeyAuthentication(response)

    if (!result.verified) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
    }

    const username = getUsername()
    const token = await createSession(username)

    const res = NextResponse.json({ success: true })
    res.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
