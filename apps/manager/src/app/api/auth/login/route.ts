import { NextResponse } from "next/server"
import {
  verifyPassword,
  verifyTOTP,
  createSession,
  generateTOTPSecret,
  generateTOTPUri,
  getUsername,
} from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password, totpCode } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      )
    }

    if (username !== getUsername() || !verifyPassword(password)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    let totpSetup = null
    const totpSecret = process.env.AUTH_TOTP_SECRET || ""
    if (totpSecret) {
      // TOTP is configured — it is mandatory
      if (!totpCode || !verifyTOTP(totpCode, totpSecret)) {
        return NextResponse.json(
          { error: "Invalid OTP code" },
          { status: 401 }
        )
      }
    } else if (!totpSecret) {
      const secret = generateTOTPSecret()
      totpSetup = {
        secret,
        uri: generateTOTPUri(secret, username),
      }
    }

    const token = await createSession(username)

    const response = NextResponse.json({
      success: true,
      user: { username },
    })

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    if (totpSetup) {
      response.cookies.set("totp_pending", JSON.stringify(totpSetup), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 10,
        path: "/",
      })
    }

    return response
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
