import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const token = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1]

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const session = await verifySession(token)

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: { username: session.username },
    })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
