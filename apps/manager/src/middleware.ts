import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
}

const STATE_MODIFYING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

// Paths that do not require authentication
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/passkey/") ||
    pathname.startsWith("/api/auth/passkeys")
  )
}

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "default-secret-change-in-production-min-32-chars"
)

export async function middleware(request: NextRequest) {
  const { method, nextUrl, headers } = request
  const { pathname } = nextUrl

  // CSRF: check origin on state-modifying API requests
  const isApiRoute = pathname.startsWith("/api/")
  if (isApiRoute && STATE_MODIFYING_METHODS.has(method)) {
    const origin = headers.get("origin")
    if (origin) {
      const host = headers.get("host")
      let originHost: string
      try {
        originHost = new URL(origin).host
      } catch {
        return new NextResponse(
          JSON.stringify({ error: "Invalid Origin header" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      }

      if (originHost !== host) {
        return new NextResponse(
          JSON.stringify({ error: "Origin mismatch" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      }
    }
  }

  // Auth enforcement for non-public paths
  if (!isPublicPath(pathname)) {
    const sessionToken = request.cookies.get("session")?.value

    if (sessionToken) {
      try {
        await jwtVerify(sessionToken, SECRET_KEY)
      } catch {
        // Invalid token — redirect to login (or 401 for API routes)
        if (isApiRoute) {
          return new NextResponse(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          )
        }
        const loginUrl = nextUrl.clone()
        loginUrl.pathname = "/login"
        loginUrl.search = ""
        return NextResponse.redirect(loginUrl)
      }
    } else {
      // No token
      if (isApiRoute) {
        return new NextResponse(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      }
      const loginUrl = nextUrl.clone()
      loginUrl.pathname = "/login"
      loginUrl.search = ""
      return NextResponse.redirect(loginUrl)
    }
  }

  const response = NextResponse.next()

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
